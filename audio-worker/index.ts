import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
	region: process.env.AWS_REGION || 'ap-south-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL;

const startSQSConsumer = async () => {
	if (!QUEUE_URL) {
		console.log('AWS_SQS_QUEUE_URL not set. Exiting...');
		process.exit(1);
	}

	console.log(`Starting SQS Consumer for ${QUEUE_URL}...`);

	// Simple long-polling loop
	while (true) {
		try {
			const command = new ReceiveMessageCommand({
				QueueUrl: QUEUE_URL,
				MaxNumberOfMessages: 10,
				WaitTimeSeconds: 20, // Long polling
			});

			const response = await sqsClient.send(command);

			if (response.Messages && response.Messages.length > 0) {
				for (const message of response.Messages) {
					if (message.Body) {
						try {
							// S3 Event structure
							const s3Event = JSON.parse(message.Body);

							// Handle Test Events or actual S3 events
							if (s3Event.Event === 's3:TestEvent') {
								console.log('Received S3 Test Event');
							}
							// Standard S3 Event Records
							else if (s3Event.Records) {
								for (const record of s3Event.Records) {
									const bucket = record.s3.bucket.name;
									const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
									const size = record.s3.object.size;

									// Parse Key for Metadata
									// Format: position/interviewId/date/email/chunks/filename
									const parts = key.split('/');

									// Defensive check
									if (parts.length >= 6) {
										const interviewId = parts[1];
										// filename might be playlist_001.ts
										const filename = parts[parts.length - 1];
										// extract index from filename if possible (video_000.ts)
										const match = filename ? filename.match(/_(\d+)\./) : null;
										const chunkIndex = match && match[1] ? parseInt(match[1], 10) : -1;

										console.log('------------------------------------------------');
										console.log('📦 New Audio Chunk Detected');
										console.log(`Bucket:      ${bucket}`);
										console.log(`Object Key:  ${key}`);
										console.log(`InterviewID: ${interviewId}`);
										console.log(`Chunk Index: ${chunkIndex}`);
										console.log(`Size:        ${size} bytes`);
										console.log('------------------------------------------------');
									} else {
										console.log('Received S3 object, but format was unexpected:', key);
									}
								}
							}
						} catch (e) {
							console.error('Error parsing SQS message:', e);
						}
					}

					// Delete message after processing
					await sqsClient.send(
						new DeleteMessageCommand({
							QueueUrl: QUEUE_URL,
							ReceiptHandle: message.ReceiptHandle,
						})
					);
				}
			}
		} catch (err) {
			console.error('SQS Poll Error:', err);
			// Backoff slightly on error
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}
};

startSQSConsumer();
