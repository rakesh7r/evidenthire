import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Types for session end events
interface SessionEndEvent {
	event: 'session_ended';
	interviewId: string;
	sessionId: string;
	timestamp: string;
}

// Types for transcript segments
interface TranscriptSegment {
	speaker: string;
	role: string;
	globalStartMs: number;
	globalEndMs: number;
	text: string;
	chunkFile: string;
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

async function streamToString(stream: Readable): Promise<string> {
	return await new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
	});
}

function formatTimestamp(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const millis = ms % 1000;
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
		.toString()
		.padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

const startSQSConsumer = async () => {
	if (!QUEUE_URL) {
		console.log('AWS_SQS_TRANSCRIPT_QUEUE_URL not set. Exiting...');
		process.exit(1);
	}

	if (!S3_BUCKET) {
		console.log('AWS_S3_BUCKET not set. Exiting...');
		process.exit(1);
	}

	console.log(`Starting Transcript Worker for ${QUEUE_URL}...`);

	while (true) {
		try {
			const command = new ReceiveMessageCommand({
				QueueUrl: QUEUE_URL,
				MaxNumberOfMessages: 5,
				WaitTimeSeconds: 20,
			});

			const response = await sqsClient.send(command);

			if (response.Messages && response.Messages.length > 0) {
				console.log(`Received ${response.Messages.length} messages from SQS.`);
				for (const message of response.Messages) {
					if (message.Body) {
						try {
							const body = JSON.parse(message.Body) as SessionEndEvent;

							if (body.event === 'session_ended') {
								console.log(`Processing session end for interview: ${body.interviewId}, session: ${body.sessionId}`);
								await processSessionEnd(body.interviewId, body.sessionId);
							} else {
								console.log(`Unknown event type: ${(body as any).event}`);
							}
						} catch (e) {
							console.error('Error processing message:', e);
						}
					}

					if (message.ReceiptHandle) {
						await sqsClient.send(
							new DeleteMessageCommand({
								QueueUrl: QUEUE_URL,
								ReceiptHandle: message.ReceiptHandle,
							})
						);
					}
				}
			}
		} catch (err) {
			console.error('SQS Poll Error:', err);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}
};

async function processSessionEnd(interviewId: string, sessionId: string) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`Processing transcript for Interview: ${interviewId}, Session: ${sessionId}`);
	console.log(`${'='.repeat(60)}\n`);

	try {
		// 1. Try to get the merged transcript first
		const transcriptKey = `${interviewId}/transcripts/${sessionId}.txt`;
		console.log(`Fetching transcript: s3://${S3_BUCKET}/${transcriptKey}`);

		try {
			const transcriptRes = await s3Client.send(
				new GetObjectCommand({
					Bucket: S3_BUCKET,
					Key: transcriptKey,
				})
			);
			const transcriptText = await streamToString(transcriptRes.Body as Readable);

			console.log(`\n--- MERGED TRANSCRIPT ---\n`);
			console.log(transcriptText);
			console.log(`\n--- END TRANSCRIPT ---\n`);
		} catch (err) {
			console.log(`Merged transcript not found at ${transcriptKey}`);
		}

		// 2. Also try to get the raw segments JSONL
		const segmentsKey = `${interviewId}/transcripts/${sessionId}_segments.jsonl`;
		console.log(`Fetching segments: s3://${S3_BUCKET}/${segmentsKey}`);

		try {
			const segmentsRes = await s3Client.send(
				new GetObjectCommand({
					Bucket: S3_BUCKET,
					Key: segmentsKey,
				})
			);
			const segmentsStr = await streamToString(segmentsRes.Body as Readable);

			// Parse and display segment stats
			const segments: TranscriptSegment[] = segmentsStr
				.split('\n')
				.filter((line) => line.trim())
				.map((line) => {
					try {
						return JSON.parse(line) as TranscriptSegment;
					} catch {
						return null;
					}
				})
				.filter((s): s is TranscriptSegment => s !== null);

			// Sort by global start time
			segments.sort((a, b) => a.globalStartMs - b.globalStartMs);

			console.log(`\n--- SEGMENT STATISTICS ---`);
			console.log(`Total segments: ${segments.length}`);

			// Calculate speaking time per speaker
			const speakerStats: Map<string, { role: string; totalMs: number; segments: number }> = new Map();

			for (const seg of segments) {
				const duration = seg.globalEndMs - seg.globalStartMs;
				const existing = speakerStats.get(seg.speaker);
				if (existing) {
					existing.totalMs += duration;
					existing.segments++;
				} else {
					speakerStats.set(seg.speaker, { role: seg.role, totalMs: duration, segments: 1 });
				}
			}

			console.log(`\nSpeaking time per speaker:`);
			for (const [speaker, stats] of speakerStats) {
				const minutes = Math.floor(stats.totalMs / 60000);
				const seconds = Math.floor((stats.totalMs % 60000) / 1000);
				console.log(`  ${stats.role} (${speaker}): ${minutes}m ${seconds}s (${stats.segments} segments)`);
			}

			// Detect speaker switches
			let switchCount = 0;
			let lastSpeaker = '';
			for (const seg of segments) {
				if (seg.speaker !== lastSpeaker && lastSpeaker !== '') {
					switchCount++;
				}
				lastSpeaker = seg.speaker;
			}
			console.log(`\nSpeaker switches: ${switchCount}`);

			// Session duration
			if (segments.length > 0) {
				const firstSegment = segments[0];
				const lastSegment = segments[segments.length - 1];
				if (firstSegment && lastSegment) {
					const sessionDurationMs = lastSegment.globalEndMs - firstSegment.globalStartMs;
					const durationMinutes = Math.floor(sessionDurationMs / 60000);
					const durationSeconds = Math.floor((sessionDurationMs % 60000) / 1000);
					console.log(`Session duration: ${durationMinutes}m ${durationSeconds}s`);
				}
			}

			console.log(`\n--- DETAILED SEGMENTS ---`);
			for (const seg of segments) {
				const startTime = formatTimestamp(seg.globalStartMs);
				const endTime = formatTimestamp(seg.globalEndMs);
				console.log(`[${startTime} - ${endTime}] ${seg.role.toUpperCase()} (${seg.speaker}):`);
				console.log(`  "${seg.text}"`);
			}
			console.log(`\n--- END SEGMENTS ---\n`);
		} catch (err) {
			console.log(`Segments file not found at ${segmentsKey}`);
		}

		// 3. List all files in the session folder for reference
		const sessionPrefix = `${interviewId}/sessions/${sessionId}/`;
		console.log(`\nListing session files: s3://${S3_BUCKET}/${sessionPrefix}`);

		try {
			const listRes = await s3Client.send(
				new ListObjectsV2Command({
					Bucket: S3_BUCKET,
					Prefix: sessionPrefix,
				})
			);

			if (listRes.Contents && listRes.Contents.length > 0) {
				console.log(`Session files:`);
				for (const obj of listRes.Contents) {
					console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
				}
			} else {
				console.log(`No files found in session folder.`);
			}
		} catch (err) {
			console.error('Error listing session files:', err);
		}

		console.log(`\n${'='.repeat(60)}\n`);
	} catch (err) {
		console.error(`Failed to process session end:`, err);
	}
}

startSQSConsumer();
