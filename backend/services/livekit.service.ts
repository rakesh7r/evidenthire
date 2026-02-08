import {
	AccessToken,
	EgressClient,
	EncodedFileType,
	SegmentedFileOutput,
	SegmentedFileProtocol,
	S3Upload,
	AudioCodec,
} from 'livekit-server-sdk';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getInterviewMetadataForRecording } from './interview.service';
import { getOrCreateAudioFolder, persistChunkIndex } from './interview-audio.service';
import { sql } from '../db';
import { redis } from '../redis';
import logger from '../lib/logger';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	logger.warn('LiveKit environment variables are missing. Video calls will not work.');
}

const s3Client = new S3Client({
	region: process.env.AWS_REGION || 'ap-south-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

/**
 * Get interview start time (T0) from DB or Redis
 * This serves as the anchor for calculating audio offsets properly
 */
const getInterviewStartTime = async (interviewId: string): Promise<number> => {
	const cacheKey = `interview:${interviewId}:start_time`;
	try {
		const cachedTime = await redis.get(cacheKey);
		if (cachedTime) {
			logger.info({ interviewId, time: cachedTime }, 'Got interview start time from Redis');
			return parseInt(cachedTime, 10);
		}
	} catch (e) {
		logger.warn({ error: String(e) }, 'Redis get error');
	}

	// Fetch from DB
	const result = await sql`SELECT first_join_at FROM interview WHERE id = ${interviewId}`;

	// If first_join_at is null (first person joining), use NOW
	let startTime: number;
	if (result[0]?.first_join_at) {
		startTime = new Date(result[0].first_join_at).getTime();
	} else {
		startTime = Date.now();
		// We don't update DB here; recordParticipantJoin in access service does that
	}

	// Cache it
	try {
		await redis.set(cacheKey, startTime);
	} catch (e) {
		logger.warn({ error: String(e) }, 'Redis set error');
	}

	return startTime;
};

export const createAccessToken = async (
	roomName: string,
	participantIdentity: string,
	participantName: string,
	metadata?: any
) => {
	if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
		throw new Error('LiveKit credentials are not configured');
	}

	const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
		identity: participantIdentity,
		name: participantName,
		metadata: metadata ? JSON.stringify(metadata) : undefined,
	});

	at.addGrant({ roomJoin: true, room: roomName });

	return await at.toJwt();
};

export const startRoomAudioRecording = async (roomName: string, interviewId: string) => {
	if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
		throw new Error('LiveKit credentials are not configured');
	}

	const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

	const fileOutput: any = {
		fileType: EncodedFileType.MP3,
		filepath: `interview-${interviewId}.mp3`,
	};

	try {
		const egress = await egressClient.startRoomCompositeEgress(roomName, fileOutput, {
			audioOnly: true,
		});
		logger.info({ egressId: egress.egressId, roomName }, 'Started room composite egress');
		return egress;
	} catch (error) {
		logger.error({ error: String(error), roomName }, 'Failed to start egress');
		throw error;
	}
};

export const startTrackAudioRecording = async (
	roomName: string,
	trackId: string,
	interviewId: string,
	participantIdentity?: string
) => {
	if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
		throw new Error('LiveKit credentials are not configured');
	}

	const s3Bucket = process.env.AWS_S3_BUCKET;
	const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
	const s3Secret = process.env.AWS_SECRET_ACCESS_KEY;
	const s3Region = process.env.AWS_REGION || 'ap-south-1';

	logger.info(
		{ s3Bucket, s3Region, hasAccessKey: !!s3AccessKey, hasSecret: !!s3Secret },
		'[LIVEKIT-SERVICE] Starting track egress setup'
	);

	if (!s3Bucket || !s3AccessKey || !s3Secret) {
		logger.warn('S3 credentials missing. Cannot start direct S3 egress.');
		return;
	}

	const metadata = await getInterviewMetadataForRecording(interviewId);
	if (!metadata) {
		logger.warn(`Metadata not found for interview ${interviewId}, cannot construct path.`);
		return;
	}

	// Get or create the audio folder (session-less, single folder per interview)
	const { audioFolderPath } = await getOrCreateAudioFolder(interviewId);

	// Extract email and role from identity
	let email = 'unknown';
	let role: 'candidate' | 'interviewer' | 'observer' = 'interviewer';
	if (participantIdentity) {
		if (participantIdentity.startsWith('candidate-')) {
			email = participantIdentity.replace('candidate-', '');
			role = 'candidate';
		} else if (participantIdentity.startsWith('interviewer-')) {
			email = participantIdentity.replace('interviewer-', '');
			role = 'interviewer';
		} else {
			email = participantIdentity;
		}
	}

	// Get interview start time for offset calculation
	const interviewStartTime = await getInterviewStartTime(interviewId);
	const trackStartTime = Date.now();
	const trackStartOffsetMs = trackStartTime - interviewStartTime;

	const s3AudioPrefix = `${audioFolderPath}/${email}`;
	const s3MetadataUri = `${audioFolderPath}/track_${email}.json`;

	// Store active participant info in Redis for easy lookup during processing
	// This replaces the session_participant table for now
	const redisKey = `interview:${interviewId}:track:${trackId}`;
	const trackInfo = {
		email,
		role,
		trackId,
		trackOffsetMs: trackStartOffsetMs,
		s3AudioPrefix,
		s3MetadataUri,
		joinedAt: new Date().toISOString(),
	};

	try {
		await redis.set(redisKey, JSON.stringify(trackInfo));
		// Set expiry for 24 hours just in case
		await redis.expire(redisKey, 86400);
		logger.info({ redisKey }, 'Stored track metadata in Redis');
	} catch (error) {
		logger.error({ error: String(error), redisKey }, 'Failed to store track metadata in Redis');
	}

	// Write track metadata to S3 for timeline anchoring
	// Now stored in the shared audio folder (not session-specific)
	const trackMetadata = {
		trackId,
		participantIdentity,
		email,
		role,
		interviewId,
		interviewStartTime,
		trackStartTime,
		trackStartOffsetMs,
		createdAt: new Date().toISOString(),
		// session info removed
	};

	const trackMetadataKey = `${audioFolderPath}/track_${email}.json`;
	try {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: s3Bucket,
				Key: trackMetadataKey,
				Body: JSON.stringify(trackMetadata, null, 2),
				ContentType: 'application/json',
			})
		);
		logger.info({ trackMetadataKey }, 'Track metadata written to S3');
	} catch (err) {
		logger.error({ error: String(err), trackMetadataKey }, 'Failed to write track metadata to S3');
	}

	// Filename prefix: <interview_id>/audio/<email>
	// LiveKit will append _0000.ts, _0001.ts, etc.
	// Chunk indices continue across sessions
	const filenamePrefix = `${audioFolderPath}/${email}`;
	const playlistName = `playlist_${email}.m3u8`;

	logger.info({ s3Bucket, filenamePrefix, playlistName }, '[LIVEKIT] Starting track egress');

	const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

	const s3 = new S3Upload({
		accessKey: s3AccessKey,
		secret: s3Secret,
		region: s3Region,
		bucket: s3Bucket,
	});

	const output = new SegmentedFileOutput({
		protocol: SegmentedFileProtocol.HLS_PROTOCOL,
		filenamePrefix: filenamePrefix,
		playlistName: playlistName,
		segmentDuration: 30, // 30 seconds
		output: {
			case: 's3',
			value: s3,
		},
	});

	try {
		// Use Track Composite Egress to enable transcoding and segmentation
		const egress = await egressClient.startTrackCompositeEgress(roomName, output, {
			audioTrackId: trackId,
			encodingOptions: {
				audioCodec: AudioCodec.AAC,
				audioBitrate: 128000,
				audioFrequency: 48000,
			} as any,
		});
		logger.info(
			{ egressId: egress.egressId, trackId, email, offset: trackStartOffsetMs },
			'Started segmented track egress'
		);
		return egress;
	} catch (error) {
		logger.error({ error: String(error), trackId, email }, 'Failed to start track egress');
		throw error;
	}
};
