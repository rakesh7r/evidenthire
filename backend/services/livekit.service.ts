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
import { getInterviewMetadataForRecording } from './interview.service';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	console.warn('LiveKit environment variables are missing. Video calls will not work.');
}

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

	// Path: positionname/interviewid/date/candidateemail/
	// The SegmentedFileOutput will append the suffix (e.g. _001.ts or .m3u8)
	const pathPrefix = `${safePositionName}/${metadata.id}/${date}/${metadata.candidate_email}/chunks`;

	const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

	const s3Config: any = {
		accessKey: s3AccessKey,
		secret: s3Secret, // Correct secret
		region: s3Region,
		bucket: s3Bucket,
		forcePathStyle: false,
	};

	// Use SegmentedFileOutput for 30s chunks
	// Note: TrackEgress with SegmentedFileOutput typically produces HLS (m3u8 + ts/mp4)
	// We set segmentDuration to 30.
	const output: any = {
		protocol: SegmentedFileProtocol.HLS_PROTOCOL,
		filenamePrefix: pathPrefix,
		playlistName: 'playlist.m3u8',
		segmentDuration: 30, // 30 seconds
		output: {
			case: 's3',
			value: s3Config,
		},
	};

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
		console.log(`Started segmented track egress: ${egress.egressId} for track ${trackId}`);
		return egress;
	} catch (error) {
		console.error('Failed to start track egress:', error);
		throw error;
	}
};
