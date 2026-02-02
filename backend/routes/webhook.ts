import { Hono } from 'hono';
import { TrackType, WebhookReceiver } from 'livekit-server-sdk';
import { startRoomAudioRecording, startTrackAudioRecording } from '../services/livekit.service';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const webhook = new Hono();
const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);

const sqsClient = new SQSClient({
	region: process.env.AWS_REGION || 'ap-south-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

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
				console.log('track_published', event);
				if (event.track?.type === TrackType.AUDIO) {
					const payload = {
						event: 'track_published',
						roomName,
						trackSid: event.track.sid,
						interviewId,
						timestamp: new Date().toISOString(),
					};

					console.log('payload', payload);

					await sqsClient.send(
						new SendMessageCommand({
							QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
							MessageBody: JSON.stringify(payload),
						})
					);

					await startTrackAudioRecording(roomName, event.track.sid, interviewId);
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
