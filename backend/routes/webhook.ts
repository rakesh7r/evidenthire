import { Hono } from 'hono';
import { TrackType, WebhookReceiver } from 'livekit-server-sdk';
import {
	startRoomAudioRecording,
	startTrackAudioRecording,
	invalidateSessionCache,
	getLastSessionId,
	getLastSessionRecord,
} from '../services/livekit.service';
import { endInterview } from '../services/interview-access.service';
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

				// Get the session record from database (more reliable than string ID)
				const sessionRecord = await getLastSessionRecord(interviewId);
				const sessionId = sessionRecord
					? `session${sessionRecord.session_number}`
					: await getLastSessionId(interviewId);

				if (sessionId && process.env.AWS_SQS_TRANSCRIPT_QUEUE_URL) {
					// Send session_ended event to transcript worker queue with DB record info
					const payload = {
						event: 'session_ended',
						interviewId,
						sessionId,
						sessionDbId: sessionRecord?.id, // Include database ID for more reliable lookups
						sessionNumber: sessionRecord?.session_number,
						timestamp: new Date().toISOString(),
					};

					await sqsClient.send(
						new SendMessageCommand({
							QueueUrl: process.env.AWS_SQS_TRANSCRIPT_QUEUE_URL,
							MessageBody: JSON.stringify(payload),
						})
					);
					console.log(
						`Session ended event sent to transcript queue for session ${sessionId} (DB ID: ${sessionRecord?.id})`
					);
				}

				// Invalidate session cache so next session gets a new ID (this is now async)
				await invalidateSessionCache(interviewId);

				// Auto-end the interview if it wasn't manually ended by the interviewer
				// This is a normal room finish, so participants left
				const endResult = await endInterview(interviewId, 'normal');
				if (endResult.success) {
					console.log(`Interview ${interviewId} auto-ended with status: ${endResult.status}`);
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
