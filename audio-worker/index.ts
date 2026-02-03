import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';

// Types for transcript segments
interface TranscriptSegment {
	speaker: string;
	role: string;
	globalStartMs: number;
	globalEndMs: number;
	text: string;
	chunkFile: string;
}

interface TrackMetadata {
	trackId: string;
	participantIdentity: string;
	email: string;
	role: string;
	sessionId: string;
	sessionStartTime: number;
	trackStartTime: number;
	trackStartOffsetMs: number;
	createdAt: string;
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

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL;

async function streamToString(stream: Readable): Promise<string> {
	return await new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
	});
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	return await new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});
}

function parseM3u8(content: string) {
	const lines = content.split('\n');
	let currentTime = 0;
	const segments: { duration: number; uri: string; startTime: number }[] = [];

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];
		if (rawLine === undefined) continue;

		const line = rawLine.trim();
		if (line.startsWith('#EXTINF:')) {
			const durationPart = line.split(':')[1];
			if (!durationPart) continue;

			const duration = parseFloat(durationPart.replace(',', ''));
			// The next line should be the URI
			const uri = lines[i + 1]?.trim();
			if (uri && !uri.startsWith('#')) {
				segments.push({ duration, uri, startTime: currentTime });
				currentTime += duration;
			}
		}
	}
	return segments;
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
		console.log('AWS_SQS_QUEUE_URL not set. Exiting...');
		process.exit(1);
	}

	if (!process.env.OPENAI_API_KEY) {
		console.log('OPENAI_API_KEY not set. Transcription will act as mock.');
	}

	console.log(`Starting SQS Consumer for ${QUEUE_URL}...`);

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
							const body = JSON.parse(message.Body);

							if (body.event === 'track_published') {
								console.log(`Received track_published event for room: ${body.roomName} (Track: ${body.trackSid})`);
							} else if (body.Records) {
								for (const record of body.Records) {
									if (!record.s3 || !record.s3.bucket || !record.s3.object) continue;

									const bucket = record.s3.bucket.name;
									const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
									// We only care about audio chunks (e.g., .ts or .m4a)
									if (key.endsWith('.ts') || key.endsWith('.m4a') || key.endsWith('.mp3')) {
										console.log(`Processing chunk: ${key}`);
										await processAudioChunk(bucket, key);
									}
								}
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

async function getTrackMetadata(bucket: string, sessionPath: string, email: string): Promise<TrackMetadata | null> {
	const metadataKey = `${sessionPath}/track_${email}.json`;
	try {
		const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: metadataKey }));
		const content = await streamToString(res.Body as Readable);
		return JSON.parse(content) as TrackMetadata;
	} catch (err) {
		console.log(`Track metadata not found: ${metadataKey}`);
		return null;
	}
}

async function processAudioChunk(bucket: string, key: string) {
	const parts = key.split('/');
	const filename = parts.pop();
	const sessionPath = parts.join('/'); // .../sessions/sessionX
	console.log(`[${key}] Starting processing...`);

	try {
		if (!filename) return;

		// Extract email from filename (format: email_00001.ts)
		const emailMatch = filename.match(/^(.+)_(\d+)\.(ts|m4a|mp3)$/);
		if (!emailMatch) {
			console.log(`[${key}] Invalid filename format or could not extract email. Skipping.`);
			return;
		}

		const email = emailMatch[1];
		if (!email) {
			console.log(`[${key}] Could not extract email from filename. Skipping.`);
			return;
		}
		const playlistKey = `${sessionPath}/playlist_${email}.m3u8`;

		// 1. Get track metadata for timeline anchoring
		const trackMetadata = await getTrackMetadata(bucket, sessionPath, email);
		const trackStartOffsetMs = trackMetadata?.trackStartOffsetMs || 0;
		const role = trackMetadata?.role || 'unknown';

		console.log(`[${key}] Track offset: ${trackStartOffsetMs}ms, Role: ${role}`);

		// 2. Fetch Playlist to find segment start time within track
		console.log(`[${key}] Fetching playlist: ${playlistKey}`);
		const playlistRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: playlistKey }));
		const playlistStr = await streamToString(playlistRes.Body as Readable);
		const segments = parseM3u8(playlistStr);

		const segment = segments.find((s) => s.uri === filename);
		const segmentStartTimeSeconds = segment ? segment.startTime : 0;
		const segmentDurationSeconds = segment ? segment.duration : 30;

		// Global start time = track offset + segment start time within track
		const globalSegmentStartMs = trackStartOffsetMs + segmentStartTimeSeconds * 1000;

		// 3. Fetch Audio Chunk
		console.log(`[${key}] Fetching audio chunk...`);
		const audioRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		const audioBuffer = await streamToBuffer(audioRes.Body as Readable);

		// 4. Transcribe with timestamps
		const transcriptSegments: TranscriptSegment[] = [];

		if (process.env.OPENAI_API_KEY) {
			// Convert TS to MP3 using ffmpeg
			const tempTsFile = path.join(os.tmpdir(), `${filename}-${Date.now()}.ts`);
			const tempMp3File = path.join(os.tmpdir(), `${filename}-${Date.now()}.mp3`);

			await fs.promises.writeFile(tempTsFile, audioBuffer);

			console.log(`[${key}] Converting .ts to .mp3...`);
			await new Promise<void>((resolve, reject) => {
				ffmpeg(tempTsFile)
					.toFormat('mp3')
					.on('error', (err) => reject(err))
					.on('end', () => resolve())
					.save(tempMp3File);
			});

			console.log(`[${key}] Conversion complete. Sending to OpenAI with timestamps...`);

			const mp3Buffer = await fs.promises.readFile(tempMp3File);
			const file = new File([mp3Buffer], 'audio.mp3', { type: 'audio/mpeg' });

			// Request verbose JSON to get word-level timestamps
			const transcription = await openai.audio.transcriptions.create({
				file: file,
				model: 'whisper-1',
				response_format: 'verbose_json',
				timestamp_granularities: ['segment'],
			});

			// Process segments from Whisper
			if (transcription.segments && Array.isArray(transcription.segments)) {
				for (const seg of transcription.segments) {
					// Whisper segment times are relative to the audio file
					// Global time = track offset + playlist segment start + whisper segment start
					const whisperStartMs = (seg.start || 0) * 1000;
					const whisperEndMs = (seg.end || 0) * 1000;

					const globalStartMs = globalSegmentStartMs + whisperStartMs;
					const globalEndMs = globalSegmentStartMs + whisperEndMs;

					transcriptSegments.push({
						speaker: email,
						role: role,
						globalStartMs,
						globalEndMs,
						text: seg.text?.trim() || '',
						chunkFile: filename as string,
					});
				}
			} else if (transcription.text) {
				// Fallback if no segments available
				transcriptSegments.push({
					speaker: email,
					role: role,
					globalStartMs: globalSegmentStartMs,
					globalEndMs: globalSegmentStartMs + segmentDurationSeconds * 1000,
					text: transcription.text,
					chunkFile: filename as string,
				});
			}

			// Cleanup temp files
			await fs.promises.unlink(tempTsFile).catch(() => {});
			await fs.promises.unlink(tempMp3File).catch(() => {});
		} else {
			// Mock transcription
			transcriptSegments.push({
				speaker: email,
				role: role,
				globalStartMs: globalSegmentStartMs,
				globalEndMs: globalSegmentStartMs + segmentDurationSeconds * 1000,
				text: `[Mock Transcription for ${filename}]`,
				chunkFile: filename as string,
			});
		}

		console.log(`[${key}] Transcribed ${transcriptSegments.length} segments`);

		// 5. Extract path components
		const sessionsIndex = parts.indexOf('sessions');
		if (sessionsIndex === -1) {
			console.log(`[${key}] 'sessions' folder not found. Skipping.`);
			return;
		}

		const interviewFolder = parts.slice(0, sessionsIndex).join('/');
		const sessionFolderName = parts[sessionsIndex + 1];
		if (!sessionFolderName) {
			console.log(`[${key}] Could not extract session folder name.`);
			return;
		}

		// 6. Append segments to JSON Lines file (for merging later)
		const segmentsKey = `${interviewFolder}/transcripts/${sessionFolderName}_segments.jsonl`;

		let existingSegments = '';
		try {
			const existing = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: segmentsKey }));
			existingSegments = await streamToString(existing.Body as Readable);
		} catch (e) {
			// File doesn't exist yet
		}

		const newLines = transcriptSegments.map((s) => JSON.stringify(s)).join('\n');
		const updatedSegments = existingSegments ? existingSegments + '\n' + newLines : newLines;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: segmentsKey,
				Body: updatedSegments,
				ContentType: 'application/x-ndjson',
			})
		);

		// 7. Also generate human-readable transcript (merged and sorted)
		await generateMergedTranscript(bucket, interviewFolder, sessionFolderName);

		console.log(`[${key}] Processing complete.`);
	} catch (err) {
		console.error(`Failed to process chunk ${key}:`, err);
	}
}

async function generateMergedTranscript(bucket: string, interviewFolder: string, sessionFolderName: string) {
	const segmentsKey = `${interviewFolder}/transcripts/${sessionFolderName}_segments.jsonl`;
	const transcriptKey = `${interviewFolder}/transcripts/${sessionFolderName}.txt`;

	try {
		// Read all segments
		const segmentsRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: segmentsKey }));
		const segmentsStr = await streamToString(segmentsRes.Body as Readable);

		// Parse JSONL
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

		// Detect speaker switches and generate transcript
		let transcript = '';
		let lastSpeaker = '';

		for (const seg of segments) {
			const timestamp = formatTimestamp(seg.globalStartMs);
			const speakerLabel = seg.role === 'candidate' ? `Candidate (${seg.speaker})` : `Interviewer (${seg.speaker})`;

			// Add speaker header on speaker switch
			if (seg.speaker !== lastSpeaker) {
				transcript += `\n[${timestamp}] ${speakerLabel}:\n`;
				lastSpeaker = seg.speaker;
			}

			transcript += `${seg.text} `;
		}

		// Write merged transcript
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: transcriptKey,
				Body: transcript.trim(),
				ContentType: 'text/plain',
			})
		);

		console.log(`Updated merged transcript: ${transcriptKey}`);
	} catch (err) {
		console.error(`Failed to generate merged transcript:`, err);
	}
}

startSQSConsumer();
