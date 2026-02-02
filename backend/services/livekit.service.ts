import {
	AccessToken,
	EgressClient,
	EncodedFileOutput,
	EncodedFileType,
	SegmentedFileOutput,
	SegmentedFileProtocol,
	S3Upload,
	AudioCodec,
} from 'livekit-server-sdk';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getInterviewMetadataForRecording } from './interview.service';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	console.warn('LiveKit environment variables are missing. Video calls will not work.');
}

const s3Client = new S3Client({
	region: process.env.AWS_REGION || 'us-east-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

// Cache to track session start times (used for anchoring track timestamps)
const sessionStartTimeCache: Map<string, number> = new Map();

const getNextSessionId = async (bucket: string, prefix: string): Promise<string> => {
	try {
		console.log(`Checking sessions in bucket: ${bucket} with prefix: ${prefix}`);
		const command = new ListObjectsV2Command({
			Bucket: bucket,
			Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
			Delimiter: '/',
		});
		const response = await s3Client.send(command);
		const commonPrefixes = response.CommonPrefixes || [];

		let maxSession = 0;
		for (const p of commonPrefixes) {
			const parts = p.Prefix?.split('/') || [];
			// parts might be ["prefix", "...", "session1", ""]
			const folderName = parts[parts.length - 2];
			if (folderName && folderName.startsWith('session')) {
				const num = parseInt(folderName.replace('session', ''), 10);
				if (!isNaN(num) && num > maxSession) {
					maxSession = num;
				}
			}
		}

		return `session${maxSession + 1}`;
	} catch (error) {
		console.error('Error fetching next session ID:', error);
		return 'session1'; // Default start
	}
};

// Cache to track active session per interview
// This ensures all participants joining the same session use the same session ID
// Session expires after SESSION_TTL_MS of inactivity (e.g., when interview ends and restarts)
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const activeSessionCache: Map<string, { sessionId: string; expiresAt: number }> = new Map();

const getOrCreateSessionId = async (bucket: string, interviewId: string, sessionsBasePath: string): Promise<string> => {
	const now = Date.now();
	const cached = activeSessionCache.get(interviewId);

	// If we have a valid cached session (not expired), use it
	if (cached && cached.expiresAt > now) {
		// Extend the TTL since there's activity
		cached.expiresAt = now + SESSION_TTL_MS;
		console.log(`Using cached session for interview ${interviewId}: ${cached.sessionId}`);
		return cached.sessionId;
	}

	// No valid cache, fetch the next session ID from S3
	const sessionId = await getNextSessionId(bucket, sessionsBasePath);

	// Cache it with TTL
	activeSessionCache.set(interviewId, {
		sessionId,
		expiresAt: now + SESSION_TTL_MS,
	});

	// Track session start time for this interview+session combo
	const sessionKey = `${interviewId}:${sessionId}`;
	if (!sessionStartTimeCache.has(sessionKey)) {
		sessionStartTimeCache.set(sessionKey, now);
		console.log(`Session start time recorded for ${sessionKey}: ${now}`);
	}

	console.log(`Created new session for interview ${interviewId}: ${sessionId}`);
	return sessionId;
};

// Function to get the last session ID for an interview (before cache is invalidated)
export const getLastSessionId = (interviewId: string): string | null => {
	const cached = activeSessionCache.get(interviewId);
	return cached?.sessionId || null;
};

// Function to invalidate session cache (call when interview ends)
export const invalidateSessionCache = (interviewId: string) => {
	const cached = activeSessionCache.get(interviewId);
	if (cached) {
		// Also clear the session start time
		const sessionKey = `${interviewId}:${cached.sessionId}`;
		sessionStartTimeCache.delete(sessionKey);
	}
	activeSessionCache.delete(interviewId);
	console.log(`Session cache invalidated for interview ${interviewId}`);
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

	// The destination will be a file named after the interview
	// Note: RoomCompositeEgress supports MP4, OGG, MP3.
	const fileOutput: any = {
		fileType: EncodedFileType.MP3,
		filepath: `interview-${interviewId}.mp3`,
	};

	try {
		// startRoomCompositeEgress expects (roomName, output, options)
		const egress = await egressClient.startRoomCompositeEgress(roomName, fileOutput, {
			audioOnly: true,
		});
		console.log(`Started egress: ${egress.egressId} for room ${roomName}`);
		return egress;
	} catch (error) {
		console.error('Failed to start egress:', error);
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
	const s3Region = process.env.AWS_REGION || 'us-east-1';

	if (!s3Bucket || !s3AccessKey || !s3Secret) {
		console.warn('S3 credentials missing. Cannot start direct S3 egress.');
		return;
	}

	const metadata = await getInterviewMetadataForRecording(interviewId);
	if (!metadata) {
		console.warn(`Metadata not found for interview ${interviewId}, cannot construct path.`);
		return;
	}

	// Determine session ID - uses cache to ensure all participants in the same session use the same ID
	const sessionsBasePath = `${metadata.id}/sessions`;
	const sessionId = await getOrCreateSessionId(s3Bucket, interviewId, sessionsBasePath);

	const basePath = `${sessionsBasePath}/${sessionId}`;

	// Extract email and role from identity
	let email = 'unknown';
	let role = 'unknown';
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

	// Get session start time and calculate track start offset
	const sessionKey = `${interviewId}:${sessionId}`;
	const sessionStartTime = sessionStartTimeCache.get(sessionKey) || Date.now();
	const trackStartTime = Date.now();
	const trackStartOffsetMs = trackStartTime - sessionStartTime;

	// Write track metadata to S3 for timeline anchoring
	const trackMetadata = {
		trackId,
		participantIdentity,
		email,
		role,
		sessionId,
		sessionStartTime,
		trackStartTime,
		trackStartOffsetMs,
		createdAt: new Date().toISOString(),
	};

	const trackMetadataKey = `${basePath}/track_${email}.json`;
	try {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: s3Bucket,
				Key: trackMetadataKey,
				Body: JSON.stringify(trackMetadata, null, 2),
				ContentType: 'application/json',
			})
		);
		console.log(`Track metadata written to S3: ${trackMetadataKey}`);
	} catch (err) {
		console.error(`Failed to write track metadata to S3:`, err);
	}

	// Filename prefix: .../sessionX/<email>
	// LiveKit will append _0000.ts, _0001.ts, etc.
	const filenamePrefix = `${basePath}/${email}`;
	const playlistName = `playlist_${email}.m3u8`;

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
				audioCodec: AudioCodec.AAC, // AAC is standard for HLS, produces .ts or .m4s segments
				audioBitrate: 128000,
				audioFrequency: 48000,
			} as any,
		});
		console.log(
			`Started segmented track egress: ${egress.egressId} for track ${trackId} in session ${sessionId} for ${email} (offset: ${trackStartOffsetMs}ms)`
		);
		return egress;
	} catch (error) {
		console.error('Failed to start track egress:', error);
		throw error;
	}
};
