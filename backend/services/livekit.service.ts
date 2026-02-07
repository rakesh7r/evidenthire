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
import {
	getOrCreateSession,
	getActiveSession,
	endSession,
	upsertSessionParticipant,
	type InterviewSession,
} from './session.service';

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

// In-memory cache for session start times (for quick offset calculation)
const sessionStartTimeCache: Map<string, number> = new Map();

/**
 * Get or create a session using the database
 * Sessions are still used for participant tracking, but audio goes to shared folder
 */
const getOrCreateSessionFromDb = async (
	interviewId: string,
	s3Bucket: string
): Promise<{ session: InterviewSession; sessionId: string; isNew: boolean }> => {
	const { session, isNew } = await getOrCreateSession(interviewId, s3Bucket);
	const sessionId = `session${session.session_number}`;

	// Cache the session start time for quick access
	const sessionKey = `${interviewId}:${sessionId}`;
	if (!sessionStartTimeCache.has(sessionKey)) {
		const startTime = new Date(session.started_at).getTime();
		sessionStartTimeCache.set(sessionKey, startTime);
		console.log(`Session start time cached for ${sessionKey}: ${startTime}`);
	}

	return { session, sessionId, isNew };
};

/**
 * Invalidate/end a session (call when interview room ends)
 * Also persists the chunk index to database
 */
export const invalidateSessionCache = async (interviewId: string): Promise<void> => {
	// Get the active session from database
	const session = await getActiveSession(interviewId);
	if (session) {
		// Calculate duration
		const startTime = new Date(session.started_at).getTime();
		const endTime = Date.now();
		const durationMs = endTime - startTime;

		// Mark session as ended in database
		await endSession(session.id, durationMs);

		// Clear from local cache
		const sessionKey = `${interviewId}:session${session.session_number}`;
		sessionStartTimeCache.delete(sessionKey);

		console.log(`Session ${session.session_number} ended for interview ${interviewId} (duration: ${durationMs}ms)`);
	} else {
		console.log(`No active session to invalidate for interview ${interviewId}`);
	}

	// Persist chunk index to database
	await persistChunkIndex(interviewId);
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

	// Get or create the audio folder (session-less, single folder per interview)
	const { audioFolderPath } = await getOrCreateAudioFolder(interviewId);

	// Still create session for participant tracking (but not for audio paths)
	const { session, sessionId } = await getOrCreateSessionFromDb(interviewId, s3Bucket);

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

	// Get session start time for offset calculation
	const sessionKey = `${interviewId}:${sessionId}`;
	let sessionStartTime = sessionStartTimeCache.get(sessionKey);
	if (!sessionStartTime) {
		sessionStartTime = new Date(session.started_at).getTime();
		sessionStartTimeCache.set(sessionKey, sessionStartTime);
	}

	const trackStartTime = Date.now();
	const trackStartOffsetMs = trackStartTime - sessionStartTime;

	// Store participant in database (still linked to session for tracking)
	const s3AudioPrefix = `${audioFolderPath}/${email}`;
	const s3MetadataUri = `${audioFolderPath}/track_${email}.json`;

	await upsertSessionParticipant(session.id, participantIdentity || email, {
		email,
		role,
		trackId,
		trackOffsetMs: trackStartOffsetMs,
		s3AudioPrefix,
		s3MetadataUri,
	});

	// Write track metadata to S3 for timeline anchoring
	// Now stored in the shared audio folder (not session-specific)
	const trackMetadata = {
		trackId,
		participantIdentity,
		email,
		role,
		interviewId,
		sessionId, // Keep for reference
		sessionNumber: session.session_number,
		sessionStartTime,
		trackStartTime,
		trackStartOffsetMs,
		createdAt: new Date().toISOString(),
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
		console.log(`Track metadata written to S3: ${trackMetadataKey}`);
	} catch (err) {
		console.error(`Failed to write track metadata to S3:`, err);
	}

	// Filename prefix: <interview_id>/audio/<email>
	// LiveKit will append _0000.ts, _0001.ts, etc.
	// Chunk indices continue across sessions
	const filenamePrefix = `${audioFolderPath}/${email}`;
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
				audioCodec: AudioCodec.AAC,
				audioBitrate: 128000,
				audioFrequency: 48000,
			} as any,
		});
		console.log(
			`Started segmented track egress: ${egress.egressId} for track ${trackId} for ${email} (offset: ${trackStartOffsetMs}ms)`
		);
		return egress;
	} catch (error) {
		console.error('Failed to start track egress:', error);
		throw error;
	}
};
