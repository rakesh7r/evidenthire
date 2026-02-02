import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
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
								sessionId: body.sessionId,
							});

							if (body.event === 'session_ended') {
								log('INFO', `>>> Processing session_ended event <<<`);
								log('INFO', `Interview ID: ${body.interviewId}`);
								log('INFO', `Session ID: ${body.sessionId}`);
								log('INFO', `Timestamp: ${body.timestamp}`);

								await processSessionEnd(body.interviewId, body.sessionId);

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

async function processSessionEnd(interviewId: string, sessionId: string) {
	log('INFO', `\n${'='.repeat(60)}`);
	log('INFO', `Processing transcript for Interview: ${interviewId}, Session: ${sessionId}`);
	log('INFO', `${'='.repeat(60)}`);

	try {
		// 1. Try to get the merged transcript
		const transcriptKey = `${interviewId}/transcripts/${sessionId}.txt`;
		log('INFO', `Fetching transcript from: s3://${S3_BUCKET}/${transcriptKey}`);

		let transcriptText = '';
		try {
			const transcriptRes = await s3Client.send(
				new GetObjectCommand({
					Bucket: S3_BUCKET,
					Key: transcriptKey,
				})
			);
			transcriptText = await streamToString(transcriptRes.Body as Readable);

			log('INFO', `--- SESSION TRANSCRIPT (${sessionId}) ---`);
			console.log(transcriptText);
			log('INFO', `--- END SESSION TRANSCRIPT ---`);
		} catch (err: any) {
			log('WARN', `Transcript not found at ${transcriptKey}: ${err.name}`);
		}

		// 2. Get the raw segments JSONL
		const segmentsKey = `${interviewId}/transcripts/${sessionId}_segments.jsonl`;
		log('INFO', `Fetching segments from: s3://${S3_BUCKET}/${segmentsKey}`);

		let segments: TranscriptSegment[] = [];
		try {
			const segmentsRes = await s3Client.send(
				new GetObjectCommand({
					Bucket: S3_BUCKET,
					Key: segmentsKey,
				})
			);
			const segmentsStr = await streamToString(segmentsRes.Body as Readable);

			segments = segmentsStr
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

			segments.sort((a, b) => a.globalStartMs - b.globalStartMs);

			log('INFO', `Loaded ${segments.length} segments`);

			// Calculate statistics
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

			log('INFO', '--- SPEAKER STATISTICS ---');
			for (const [speaker, stats] of speakerStats) {
				const minutes = Math.floor(stats.totalMs / 60000);
				const seconds = Math.floor((stats.totalMs % 60000) / 1000);
				log('INFO', `  ${stats.role} (${speaker}): ${minutes}m ${seconds}s (${stats.segments} segments)`);
			}
		} catch (err: any) {
			log('WARN', `Segments file not found at ${segmentsKey}: ${err.name}`);
		}

		// 3. List all sessions for this interview and create aggregated transcript
		log('INFO', 'Creating aggregated transcript for all sessions...');
		await createAggregatedTranscript(interviewId);

		// 4. List session files
		const sessionPrefix = `${interviewId}/sessions/${sessionId}/`;
		log('INFO', `Listing session files: s3://${S3_BUCKET}/${sessionPrefix}`);

		try {
			const listRes = await s3Client.send(
				new ListObjectsV2Command({
					Bucket: S3_BUCKET,
					Prefix: sessionPrefix,
				})
			);

			if (listRes.Contents && listRes.Contents.length > 0) {
				log('INFO', `Session files (${listRes.Contents.length} total):`);
				for (const obj of listRes.Contents) {
					log('DEBUG', `  - ${obj.Key} (${obj.Size} bytes)`);
				}
			} else {
				log('WARN', 'No files found in session folder');
			}
		} catch (err: any) {
			log('ERROR', `Error listing session files: ${err.name}`);
		}

		log('INFO', `${'='.repeat(60)}\n`);
	} catch (err) {
		log('ERROR', `Failed to process session end:`, { error: String(err) });
	}
}

async function createAggregatedTranscript(interviewId: string) {
	log('INFO', `Creating aggregated transcript for interview: ${interviewId}`);

	try {
		// List all session folders
		const sessionsPrefix = `${interviewId}/sessions/`;
		const listRes = await s3Client.send(
			new ListObjectsV2Command({
				Bucket: S3_BUCKET,
				Prefix: sessionsPrefix,
				Delimiter: '/',
			})
		);

		const sessionFolders = listRes.CommonPrefixes || [];
		log('INFO', `Found ${sessionFolders.length} session(s)`);

		if (sessionFolders.length === 0) {
			log('WARN', 'No sessions found for aggregation');
			return;
		}

		// Extract session IDs and sort them
		const sessionIds: string[] = [];
		for (const folder of sessionFolders) {
			const parts = folder.Prefix?.split('/') || [];
			const sessionFolder = parts[parts.length - 2];
			if (sessionFolder && sessionFolder.startsWith('session')) {
				sessionIds.push(sessionFolder);
			}
		}
		sessionIds.sort((a, b) => {
			const numA = parseInt(a.replace('session', ''), 10);
			const numB = parseInt(b.replace('session', ''), 10);
			return numA - numB;
		});

		log('INFO', `Sessions to aggregate: ${sessionIds.join(', ')}`);

		// Build aggregated transcript
		let aggregatedTranscript = '';
		aggregatedTranscript += `${'='.repeat(80)}\n`;
		aggregatedTranscript += `INTERVIEW TRANSCRIPT\n`;
		aggregatedTranscript += `Interview ID: ${interviewId}\n`;
		aggregatedTranscript += `Generated: ${new Date().toISOString()}\n`;
		aggregatedTranscript += `Total Sessions: ${sessionIds.length}\n`;
		aggregatedTranscript += `${'='.repeat(80)}\n\n`;

		let totalSegments = 0;
		let totalDurationMs = 0;
		const allSpeakers: Set<string> = new Set();

		for (const sessionId of sessionIds) {
			aggregatedTranscript += `\n${'─'.repeat(80)}\n`;
			aggregatedTranscript += `SESSION: ${sessionId.toUpperCase()}\n`;
			aggregatedTranscript += `${'─'.repeat(80)}\n\n`;

			// Try to get session transcript
			const transcriptKey = `${interviewId}/transcripts/${sessionId}.txt`;
			try {
				const transcriptRes = await s3Client.send(
					new GetObjectCommand({
						Bucket: S3_BUCKET,
						Key: transcriptKey,
					})
				);
				const transcriptText = await streamToString(transcriptRes.Body as Readable);
				aggregatedTranscript += transcriptText + '\n';
			} catch (err) {
				log('DEBUG', `No transcript for ${sessionId}, trying segments...`);

				// Try segments file
				const segmentsKey = `${interviewId}/transcripts/${sessionId}_segments.jsonl`;
				try {
					const segmentsRes = await s3Client.send(
						new GetObjectCommand({
							Bucket: S3_BUCKET,
							Key: segmentsKey,
						})
					);
					const segmentsStr = await streamToString(segmentsRes.Body as Readable);

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

					segments.sort((a, b) => a.globalStartMs - b.globalStartMs);
					totalSegments += segments.length;

					if (segments.length > 0) {
						const firstSeg = segments[0];
						const lastSeg = segments[segments.length - 1];
						if (firstSeg && lastSeg) {
							totalDurationMs += lastSeg.globalEndMs - firstSeg.globalStartMs;
						}
					}

					// Format segments
					let lastSpeaker = '';
					for (const seg of segments) {
						allSpeakers.add(seg.speaker);
						const timestamp = formatTimestamp(seg.globalStartMs);
						const speakerLabel =
							seg.role === 'candidate' ? `Candidate (${seg.speaker})` : `Interviewer (${seg.speaker})`;

						if (seg.speaker !== lastSpeaker) {
							aggregatedTranscript += `\n[${timestamp}] ${speakerLabel}:\n`;
							lastSpeaker = seg.speaker;
						}
						aggregatedTranscript += `${seg.text} `;
					}
					aggregatedTranscript += '\n';
				} catch (segErr) {
					aggregatedTranscript += `[No transcript available for this session]\n`;
				}
			}
		}

		// Add summary footer
		aggregatedTranscript += `\n${'='.repeat(80)}\n`;
		aggregatedTranscript += `SUMMARY\n`;
		aggregatedTranscript += `${'='.repeat(80)}\n`;
		aggregatedTranscript += `Total Sessions: ${sessionIds.length}\n`;
		aggregatedTranscript += `Total Segments: ${totalSegments}\n`;
		aggregatedTranscript += `Total Duration: ${Math.floor(totalDurationMs / 60000)}m ${Math.floor(
			(totalDurationMs % 60000) / 1000
		)}s\n`;
		aggregatedTranscript += `Participants: ${Array.from(allSpeakers).join(', ')}\n`;
		aggregatedTranscript += `${'='.repeat(80)}\n`;

		// Save aggregated transcript
		const aggregatedKey = `${interviewId}/transcripts/full_transcript.txt`;
		await s3Client.send(
			new PutObjectCommand({
				Bucket: S3_BUCKET,
				Key: aggregatedKey,
				Body: aggregatedTranscript,
				ContentType: 'text/plain',
			})
		);

		log('INFO', `Aggregated transcript saved to: s3://${S3_BUCKET}/${aggregatedKey}`);
		log('INFO', '--- AGGREGATED TRANSCRIPT PREVIEW ---');
		console.log(
			aggregatedTranscript.substring(0, 2000) + (aggregatedTranscript.length > 2000 ? '\n... [truncated]' : '')
		);
		log('INFO', '--- END PREVIEW ---');
	} catch (err) {
		log('ERROR', `Failed to create aggregated transcript:`, { error: String(err) });
	}
}

startSQSConsumer();
