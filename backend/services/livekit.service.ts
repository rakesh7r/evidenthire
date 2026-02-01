import { AccessToken } from 'livekit-server-sdk';

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
