import { Hono } from 'hono';
import { WebhookReceiver, TrackType } from 'livekit-server-sdk';
import { startRoomAudioRecording, startTrackAudioRecording } from '../services/livekit.service';

const webhook = new Hono();
const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);

webhook.post('/', async (c) => {
	const body = await c.req.text();
	const authHeader = c.req.header('Authorization');

	if (!authHeader) {
		return c.json({ error: 'Missing Authorization header' }, 401);
	}

	try {
		const event = await receiver.receive(body, authHeader);
		console.log('LiveKit Webhook Event:', event.event);

		const roomName = event.room?.name;
		if (!roomName) return c.json({ success: true });

		// Use room name as interview ID
		const interviewId = roomName;

		switch (event.event) {
			case 'room_started':
				console.log(`Room started: ${roomName}.`);
				break;

			case 'track_published':
				if (event.track?.type === TrackType.AUDIO) {
					console.log(`Audio track published: ${event.track.sid} in room ${roomName}. Starting direct S3 egress...`);
					// No websocket needed. We just trigger the egress with S3 config.
					try {
						await startTrackAudioRecording(roomName, event.track.sid, interviewId);
					} catch (e) {
						console.error('Failed to start track egress:', e);
					}
				}
				break;
		}

		return c.json({ success: true });
	} catch (err: any) {
		console.error('Webhook verification failed:', err);
		return c.json({ error: err.message }, 400);
	}
});

export default webhook;
