import { Hono } from 'hono';
import { TrackType, WebhookReceiver } from 'livekit-server-sdk';
import { startRoomAudioRecording, startTrackAudioRecording } from '../services/livekit.service';
import { persistChunkIndex } from '../services/interview-audio.service';
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

				if (process.env.AWS_SQS_QUEUE_URL) {
					// Send session_ended event to AUDIO worker queue
					// We no longer use session IDs, just interview ID and timestamp
					const payload = {
						event: 'session_ended',
						interviewId,
						timestamp: new Date().toISOString(),
					};

					try {
						await sqsClient.send(
							new SendMessageCommand({
								QueueUrl: process.env.AWS_SQS_QUEUE_URL,
								MessageBody: JSON.stringify(payload),
							})
						);
						logger.info({ interviewId }, '[LIVEKIT-WEBHOOK] Session ended event sent to audio worker queue');
					} catch (e) {
						logger.error({ error: String(e), interviewId }, 'Failed to send session_ended to SQS');
					}
				}

				// Persist chunk index to database
				await persistChunkIndex(interviewId);

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
