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
import logger from '../lib/logger';

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
		logger.info({ event: event.event, room: event.room?.name }, '[LIVEKIT-WEBHOOK] Received event');

		const roomName = event.room?.name;
		if (!roomName) return c.json({ success: true });
		// Use room name as interview ID
		const interviewId = roomName;
		switch (event.event) {
			case 'room_started':
				logger.info({ roomName }, '[LIVEKIT-WEBHOOK] Room started');
				break;

			case 'track_published':
				logger.info(
					{
						trackSid: event.track?.sid,
						type: event.track?.type,
						participant: event.participant?.identity,
						trackTypeTypeOf: typeof event.track?.type,
					},
					'[LIVEKIT-WEBHOOK] Track published'
				);

				// Check for AUDIO type (handle both enum and string cases just in case)
				// TrackType.AUDIO is usually 0, but sometimes webhooks send strings "AUDIO"
				const isAudio =
					event.track?.type === TrackType.AUDIO ||
					(typeof event.track?.type === 'string' && event.track?.type === 'AUDIO');

				if (isAudio && event.track?.sid) {
					const payload = {
						event: 'track_published',
						roomName,
						trackSid: event.track.sid,
						interviewId,
						timestamp: new Date().toISOString(),
					};

					logger.info(
						{ roomName, trackSid: event.track.sid, interviewId },
						'[LIVEKIT-WEBHOOK] Starting audio recording for track'
					);

					try {
						await sqsClient.send(
							new SendMessageCommand({
								QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
								MessageBody: JSON.stringify(payload),
							})
						);
						logger.info({ trackSid: event.track.sid }, '[LIVEKIT-WEBHOOK] Track published event sent to SQS');

						await startTrackAudioRecording(roomName, event.track.sid, interviewId, event.participant?.identity);
						logger.info({ trackSid: event.track.sid }, '[LIVEKIT-WEBHOOK] Successfully started track audio recording');
					} catch (err: any) {
						logger.error(
							{ error: String(err), trackSid: event.track?.sid },
							'[LIVEKIT-WEBHOOK] Failed to process track_published'
						);
					}
				} else {
					logger.info(
						{ type: event.track?.type, isAudio },
						'[LIVEKIT-WEBHOOK] Skipping track (not AUDIO or missing SID)'
					);
				}
				break;

			case 'room_finished':
				logger.info({ roomName }, '[LIVEKIT-WEBHOOK] Room finished: Processing session end');

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
					logger.info(
						{ sessionId, sessionDbId: sessionRecord?.id },
						'[LIVEKIT-WEBHOOK] Session ended event sent to transcript queue'
					);
				}

				// Invalidate session cache so next session gets a new ID (this is now async)
				await invalidateSessionCache(interviewId);

				// Auto-end the interview if it wasn't manually ended by the interviewer
				// This is a normal room finish, so participants left
				const endResult = await endInterview(interviewId, 'normal');
				if (endResult.success) {
					logger.info({ interviewId, status: endResult.status }, '[LIVEKIT-WEBHOOK] Interview auto-ended');
				}
				break;
		}

		return c.json({ success: true });
	} catch (err: any) {
		logger.error({ error: String(err) }, '[LIVEKIT-WEBHOOK] Webhook verification failed');
		return c.json({ error: err.message }, 400);
	}
});

export default webhook;
