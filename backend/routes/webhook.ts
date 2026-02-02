import { Hono } from 'hono';
import { TrackType, WebhookReceiver } from 'livekit-server-sdk';
import {
	startRoomAudioRecording,
	startTrackAudioRecording,
	invalidateSessionCache,
	getLastSessionId,
} from '../services/livekit.service';
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
					const payload = {
						event: 'track_published',
						roomName,
						trackSid: event.track.sid,
						interviewId,
						timestamp: new Date().toISOString(),
					};

					await sqsClient.send(
						new SendMessageCommand({
							QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
							MessageBody: JSON.stringify(payload),
						})
					);
					console.log('Track published event sent to SQS');
					await startTrackAudioRecording(roomName, event.track.sid, interviewId, event.participant?.identity);
				}
				break;

			case 'room_finished':
				console.log(`Room finished: ${roomName}. Processing session end.`);

				// Get the session ID that just ended
				const sessionId = getLastSessionId(interviewId);

				if (sessionId && process.env.AWS_SQS_TRANSCRIPT_QUEUE_URL) {
					// Send session_ended event to transcript worker queue
					const payload = {
						event: 'session_ended',
						interviewId,
						sessionId,
						timestamp: new Date().toISOString(),
					};

					await sqsClient.send(
						new SendMessageCommand({
							QueueUrl: process.env.AWS_SQS_TRANSCRIPT_QUEUE_URL,
							MessageBody: JSON.stringify(payload),
						})
					);
					console.log(`Session ended event sent to transcript queue for session ${sessionId}`);
				}

				// Invalidate session cache so next session gets a new ID
				invalidateSessionCache(interviewId);
				break;
		}

		return c.json({ success: true });
	} catch (err: any) {
		console.error('Webhook verification failed:', err);
		return c.json({ error: err.message }, 400);
	}
});

export default webhook;
