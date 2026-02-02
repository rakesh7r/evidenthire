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
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

export const startTrackAudioRecording = async (roomName: string, trackId: string, interviewId: string) => {
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

	const date = new Date(metadata.scheduled_start).toISOString().split('T')[0];
	const safePositionName = metadata.position_title.replace(/\s+/g, '-').toLowerCase();

	// Base path: positionname/candidateemail/interviewid
	const basePath = `${safePositionName}/${metadata.candidate_email}/${metadata.id}`;

	// Determine session ID
	const sessionId = await getNextSessionId(s3Bucket, basePath);
	console.log(`Checking sessions... detected next session: ${sessionId}`);

	// Final chunks path: positionname/candidateemail/interviewid/sessionX
	const pathPrefix = `${basePath}/${sessionId}`;

	const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

	const s3 = new S3Upload({
		accessKey: s3AccessKey,
		secret: s3Secret,
		region: s3Region,
		bucket: s3Bucket,
	});

	const output = new SegmentedFileOutput({
		protocol: SegmentedFileProtocol.HLS_PROTOCOL,
		filenamePrefix: pathPrefix,
		playlistName: 'playlist.m3u8',
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
		console.log(`Started segmented track egress: ${egress.egressId} for track ${trackId} in session ${sessionId}`);
		return egress;
	} catch (error) {
		console.error('Failed to start track egress:', error);
		throw error;
	}
};
