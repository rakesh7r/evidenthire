import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Types for session end events
interface SessionEndEvent {
	event: 'session_ended';
	interviewId: string;
	timestamp: string;
}

const sqsClient = new SQSClient({
	region: process.env.AWS_REGION || 'ap-south-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const s3Client = new S3Client({
	region: process.env.AWS_REGION || 'ap-south-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const QUEUE_URL = process.env.AWS_SQS_TRANSCRIPT_QUEUE_URL;
const S3_BUCKET = process.env.AWS_S3_BUCKET;

// Logging helper
function log(level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR', message: string, data?: any) {
	const timestamp = new Date().toISOString();
	const prefix = `[${timestamp}] [${level}]`;
	if (data) {
		console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
	} else {
		console.log(`${prefix} ${message}`);
	}
}

async function streamToString(stream: Readable): Promise<string> {
	return await new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
	});
}

const startSQSConsumer = async () => {
	log('INFO', '=== Transcript Worker Starting ===');
	log('INFO', 'Configuration:', {
		QUEUE_URL: QUEUE_URL ? `${QUEUE_URL.substring(0, 50)}...` : 'NOT SET',
		S3_BUCKET: S3_BUCKET || 'NOT SET',
		AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
	});

	if (!QUEUE_URL) {
		log('ERROR', 'AWS_SQS_TRANSCRIPT_QUEUE_URL not set. Exiting...');
		process.exit(1);
	}

	if (!S3_BUCKET) {
		log('ERROR', 'AWS_S3_BUCKET not set. Exiting...');
		process.exit(1);
	}

	log('INFO', `Starting SQS Consumer for queue: ${QUEUE_URL}`);
	log('INFO', 'Waiting for messages...');

	let pollCount = 0;

	while (true) {
		try {
			pollCount++;
			log('DEBUG', `Poll #${pollCount}: Checking for messages...`);

			const command = new ReceiveMessageCommand({
				QueueUrl: QUEUE_URL,
				MaxNumberOfMessages: 5,
				WaitTimeSeconds: 20,
				MessageAttributeNames: ['All'],
			});

			const response = await sqsClient.send(command);

			if (response.Messages && response.Messages.length > 0) {
				log('INFO', `Received ${response.Messages.length} message(s) from SQS`);

				for (const message of response.Messages) {
					log('DEBUG', 'Processing message:', {
						MessageId: message.MessageId,
						ReceiptHandle: message.ReceiptHandle?.substring(0, 50) + '...',
					});

					if (message.Body) {
						log('DEBUG', 'Message body:', message.Body);

						try {
							const body = JSON.parse(message.Body);
							log('INFO', 'Parsed message event:', {
								event: body.event,
								interviewId: body.interviewId,
							});

							if (body.event === 'session_ended') {
								log('INFO', `>>> Processing session_ended event <<<`);
								log('INFO', `Interview ID: ${body.interviewId}`);
								log('INFO', `Timestamp: ${body.timestamp}`);

								await processSessionEnd(body.interviewId);

								log('INFO', `<<< Finished processing session_ended event >>>`);
							} else {
								log('WARN', `Unknown event type: ${body.event}`, body);
							}
						} catch (e) {
							log('ERROR', 'Error processing message:', { error: String(e), body: message.Body });
						}
					} else {
						log('WARN', 'Message has no body');
					}

					if (message.ReceiptHandle) {
						log('DEBUG', 'Deleting message from queue...');
						await sqsClient.send(
							new DeleteMessageCommand({
								QueueUrl: QUEUE_URL,
								ReceiptHandle: message.ReceiptHandle,
							})
						);
						log('DEBUG', 'Message deleted successfully');
					}
				}
			} else {
				if (pollCount % 10 === 0) {
					log('DEBUG', `Poll #${pollCount}: No messages (still waiting...)`);
				}
			}
		} catch (err) {
			log('ERROR', 'SQS Poll Error:', { error: String(err) });
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}
};

async function processSessionEnd(interviewId: string) {
	log('INFO', `\n${'='.repeat(60)}`);
	log('INFO', `Retrieving Final Transcript for Interview: ${interviewId}`);
	log('INFO', `${'='.repeat(60)}`);

	try {
		// Fetch the transcript.txt from S3
		const transcriptKey = `${interviewId}/transcripts/transcript.txt`;
		const transcriptJsonKey = `${interviewId}/transcripts/transcript.json`;

		log('INFO', `Fetching transcript text from: s3://${S3_BUCKET}/${transcriptKey}`);

		const transcriptRes = await s3Client.send(
			new GetObjectCommand({
				Bucket: S3_BUCKET,
				Key: transcriptKey,
			})
		);
		const transcriptText = await streamToString(transcriptRes.Body as Readable);

		log('INFO', `\n--- INTERVIEW TRANSCRIPT START (TEXT) ---`);
		console.log(transcriptText);
		log('INFO', `--- INTERVIEW TRANSCRIPT END (TEXT) ---\n`);

		try {
			log('INFO', `Fetching transcript JSON from: s3://${S3_BUCKET}/${transcriptJsonKey}`);
			const transcriptJsonRes = await s3Client.send(
				new GetObjectCommand({
					Bucket: S3_BUCKET,
					Key: transcriptJsonKey,
				})
			);
			const transcriptJson = await streamToString(transcriptJsonRes.Body as Readable);
			log('INFO', `\n--- INTERVIEW TRANSCRIPT START (JSON) ---`);
			console.log(transcriptJson.substring(0, 1000) + '... (truncated)');
			log('INFO', `--- INTERVIEW TRANSCRIPT END (JSON) ---\n`);
		} catch (e) {
			log('WARN', `Could not fetch JSON transcript: ${e}`);
		}
	} catch (err: any) {
		if (err.name === 'NoSuchKey') {
			log('WARN', `No transcript found for interview ${interviewId}. It may have been empty or failed to generate.`);
		} else {
			log('ERROR', `Failed to retrieve transcript:`, { error: String(err) });
		}
	}
	log('INFO', `${'='.repeat(60)}\n`);
}

startSQSConsumer();
