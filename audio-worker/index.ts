import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { processTranscript } from './transcript-processor';
import type { TranscriptPart, TranscriptArtifact } from './types';
import { extractEvidence, generateHireSignal } from './evidence-extractor';
import { sql } from './db';
import { sendReportReadyEmail } from './email-service';

if (ffmpegPath) {
	ffmpeg.setFfmpegPath(ffmpegPath);
} else {
	console.warn('ffmpeg-static path not found, audio conversion might fail.');
}

const WAIT_TIME_SECONDS = 120;

// Types for transcript segments (Legacy/Internal use)
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
	interviewId: string;
	// Session fields removed
	interviewStartTime: number;
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

function formatTimestamp(seconds: number): string {
	const totalSeconds = Math.floor(seconds);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;
	const ms = Math.round((seconds - totalSeconds) * 1000);
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
		.toString()
		.padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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
				WaitTimeSeconds: WAIT_TIME_SECONDS,
			});

			const response = await sqsClient.send(command);

			if (response.Messages && response.Messages.length > 0) {
				console.log(`Received ${response.Messages.length} messages from SQS.`);
				for (const message of response.Messages) {
					let processingSuccess = false;
					if (message.Body) {
						try {
							const body = JSON.parse(message.Body);

							if (body.event === 'track_published') {
								console.log(
									`[SQS] Received track_published event for room: ${body.roomName} (Track: ${body.trackSid})`
								);
								processingSuccess = true;
							} else if (body.event === 'session_ended') {
								console.log(`[SQS] Received session_ended for interview ${body.interviewId}. Finalizing transcript...`);
								// Pass interviewType if available
								await handleSessionEnd(body.interviewId, body.interviewType);
								processingSuccess = true;
							} else if (body.Records) {
								// Assume success unless an error is thrown in the loop
								let allRecordsSuccess = true;
								for (const record of body.Records) {
									if (!record.s3 || !record.s3.bucket || !record.s3.object) continue;

									const bucket = record.s3.bucket.name;
									const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

									console.log(`[SQS] S3 Event: File ${key} uploaded to bucket ${bucket}`);

									// We only care about audio chunks (e.g., .ts or .m4a)
									if (key.endsWith('.ts') || key.endsWith('.m4a') || key.endsWith('.mp3')) {
										console.log(`[AUDIO-WORKER] START processing chunk: ${key}`);
										try {
											await processAudioChunk(bucket, key);
											console.log(`[AUDIO-WORKER] FINISH processing chunk: ${key}`);
										} catch (chunkError) {
											console.error(`[AUDIO-WORKER] Failed to process chunk ${key}:`, chunkError);
											allRecordsSuccess = false;
										}
									} else {
										console.log(`[AUDIO-WORKER] Ignoring non-audio file: ${key}`);
									}
								}
								processingSuccess = allRecordsSuccess;
							} else {
								console.log(`[SQS] Received unknown message format:`, body);
								processingSuccess = true; // Ack unknown messages to avoid loops
							}
						} catch (e) {
							console.error('[SQS] Error parsing/processing message body:', e);
							processingSuccess = false;
						}
					}

					if (message.ReceiptHandle && processingSuccess) {
						await sqsClient.send(
							new DeleteMessageCommand({
								QueueUrl: QUEUE_URL,
								ReceiptHandle: message.ReceiptHandle,
							})
						);
						console.log(`[SQS] Message deleted/acked.`);
					} else {
						console.log(`[SQS] Message NOT deleted (processing failed or no body). Will be retried.`);
					}
				}
			}
		} catch (err) {
			console.error('SQS Poll Error:', err);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}
};

async function getTrackMetadata(bucket: string, audioFolderPath: string, email: string): Promise<TrackMetadata | null> {
	const metadataKey = `${audioFolderPath}/track_${email}.json`;
	try {
		console.log(`[METADATA] Fetching ${metadataKey} from bucket ${bucket}`);
		const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: metadataKey }));
		const content = await streamToString(res.Body as Readable);
		return JSON.parse(content) as TrackMetadata;
	} catch (err) {
		console.log(`Track metadata not found: ${metadataKey}`);
		return null;
	}
}

async function processAudioChunk(bucket: string, key: string) {
	// New path structure: <interview_id>/audio/<email>_00001.ts
	const parts = key.split('/');
	const filename = parts.pop();
	// Construct audio folder path correctly
	const audioIndex = parts.indexOf('audio');
	if (audioIndex === -1) {
		console.log(`[${key}] Skipping: 'audio' folder not found in path.`);
		return;
	}

	// <interview_id>/audio
	const audioFolderPath = parts.slice(0, audioIndex + 1).join('/');
	// <interview_id>
	const interviewFolder = parts.slice(0, audioIndex).join('/');

	console.log(`[${key}] Starting processing... Folder: ${audioFolderPath}, Interview: ${interviewFolder}`);

	try {
		if (!filename) return;

		// Extract email and egressId from filename (format: email_egressId_chunkId.ts)
		// Example: rakesh@gmail.com_1_00000.ts
		const emailMatch = filename.match(/^(.+)_(\d+)_(\d+)\.(ts|m4a|mp3)$/);
		if (!emailMatch) {
			console.log(`[${key}] Invalid filename format: ${filename}. Skipping.`);
			return;
		}

		const email = emailMatch[1];
		const egressId = emailMatch[2];
		if (!email || !egressId) {
			console.log(`[${key}] Could not extract metadata from filename. Skipping.`);
			return;
		}

		const playlistKey = `${audioFolderPath}/playlist_${email}_${egressId}.m3u8`;

		// 1. Get track metadata for timeline anchoring
		const trackMetadata = await getTrackMetadata(bucket, audioFolderPath, email);
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
		const transcriptParts: TranscriptPart[] = [];

		if (process.env.OPENAI_API_KEY) {
			// Convert TS to MP3 using ffmpeg
			const tempTsFile = path.join(os.tmpdir(), `${filename}-${Date.now()}.ts`);
			const tempMp3File = path.join(os.tmpdir(), `${filename}-${Date.now()}.mp3`);

			await fs.promises.writeFile(tempTsFile, audioBuffer);

			console.log(`[${key}] Converting .ts to .mp3...`);
			await new Promise<void>((resolve, reject) => {
				ffmpeg(tempTsFile)
					.toFormat('mp3')
					.on('error', (err) => {
						console.error('ffmpeg conversion error:', err);
						reject(err);
					})
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
					// Whisper times are relative to this chunk (in seconds)
					// Global time = (track_offset_ms / 1000) + playlist_segment_start_s + whisper_start_s
					const chunkGlobalStartSeconds = globalSegmentStartMs / 1000;

					const startTs = chunkGlobalStartSeconds + (seg.start || 0);
					const endTs = chunkGlobalStartSeconds + (seg.end || 0);

					transcriptParts.push({
						start_ts: Number(startTs.toFixed(2)),
						end_ts: Number(endTs.toFixed(2)),
						speaker_id: email,
						role: role,
						text: seg.text?.trim() || '',
						asr_confidence: 0.95, // Whisper doesn't always give confidence per segment in simple mode, defaulting
					});
				}
			} else if (transcription.text) {
				// Fallback entire chunk
				const startTs = globalSegmentStartMs / 1000;
				const endTs = startTs + segmentDurationSeconds;
				transcriptParts.push({
					start_ts: Number(startTs.toFixed(2)),
					end_ts: Number(endTs.toFixed(2)),
					speaker_id: email,
					role: role,
					text: transcription.text,
					asr_confidence: 0.9,
				});
			}

			// Cleanup temp files
			await fs.promises.unlink(tempTsFile).catch(() => {});
			await fs.promises.unlink(tempMp3File).catch(() => {});
		} else {
			// Mock transcription
			const startTs = globalSegmentStartMs / 1000;
			const endTs = startTs + segmentDurationSeconds;
			transcriptParts.push({
				start_ts: Number(startTs.toFixed(2)),
				end_ts: Number(endTs.toFixed(2)),
				speaker_id: email,
				role: role,
				text: `[Mock Transcription for ${filename}]`,
				asr_confidence: 1.0,
			});
		}

		console.log(`[${key}] Transcribed ${transcriptParts.length} segments.`);

		// 6. Write to individual Part file
		if (transcriptParts.length > 0) {
			// Using filename as unique ID for the part.
			// filename example: rakesh@gmail.com_1_00000.ts -> rakesh@gmail.com_1_00000.json
			const partFilename = filename.replace(/\.(ts|m4a|mp3)$/, '.json');
			const partKey = `${interviewFolder}/transcripts/parts/${partFilename}`;

			await s3Client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: partKey,
					Body: JSON.stringify(transcriptParts, null, 2),
					ContentType: 'application/json',
				})
			);
			console.log(`[${key}] Saved part file to s3://${bucket}/${partKey}`);

			// 7. Regenerate merged transcript
			// Note: We don't pass interviewType here usually, as intermediate merges don't need full analysis
			// But we can if we want partial results. For now, strict 'screening' or undefined default to skip expensive LLM?
			// Let's skip LLM for intermediate chunks to save cost/latency.
			// Only perform LLM at session end.
			await generateMergedTranscript(bucket, interviewFolder, undefined);
		} else {
			console.log(`[${key}] No transcript content generated.`);
		}

		console.log(`[${key}] Processing of chunk complete.`);
	} catch (err) {
		console.error(`Failed to process chunk ${key}:`, err);
	}
}

// Updated merge function to read individual part files
async function generateMergedTranscript(bucket: string, interviewFolder: string, interviewType?: string) {
	const partsPrefix = `${interviewFolder}/transcripts/parts/`;
	const transcriptKey = `${interviewFolder}/transcripts/transcript.txt`;
	const fullJsonParamsKey = `${interviewFolder}/transcripts/transcript.json`; // Requested JSON format

	try {
		console.log(`[MERGE] Scanning for transcript parts in ${partsPrefix}`);

		// List all part files
		let allParts: TranscriptPart[] = [];
		let continuationToken: string | undefined = undefined;

		do {
			const listCmd = new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: partsPrefix,
				ContinuationToken: continuationToken,
			});
			const listRes = (await s3Client.send(listCmd)) as ListObjectsV2CommandOutput;

			if (listRes.Contents) {
				for (const obj of listRes.Contents) {
					if (obj.Key?.endsWith('.json')) {
						try {
							const partRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }));
							const partStr = await streamToString(partRes.Body as Readable);
							const parts = JSON.parse(partStr) as TranscriptPart[];
							allParts = allParts.concat(parts);
						} catch (e) {
							console.warn(`Failed to read part file ${obj.Key}`, e);
						}
					}
				}
			}
			continuationToken = listRes.NextContinuationToken;
		} while (continuationToken);

		// Sort by start_ts
		allParts.sort((a, b) => a.start_ts - b.start_ts);

		console.log(`[MERGE] Aggregated ${allParts.length} segments.`);

		// Use the new transcript processor to clean, merge and structure the data
		console.log(`[MERGE] Processing ${allParts.length} segments with advanced logic...`);
		const processedArtifact = processTranscript(allParts);

		// If we have interviewType and OpenAI key, perform analysis (Phases 6-8)
		if (interviewType && process.env.OPENAI_API_KEY) {
			console.log(`[MERGE] Performing Evidence Extraction & Analysis for type: ${interviewType}...`);
			const evidence = await extractEvidence(openai, processedArtifact.qa_spans, interviewType);
			const report = await generateHireSignal(openai, evidence, interviewType);

			processedArtifact.report = {
				evidence: evidence,
				hire_signal: report,
			};
			console.log(`[MERGE] Analysis complete. Evidence count: ${evidence.length}, Signal: ${report.hire_signal}`);
		}

		console.log(
			`[MERGE] Processed: ${processedArtifact.raw_segment_count} raw -> ${processedArtifact.canonical_segment_count} canonical segments -> ${processedArtifact.turns.length} turns.`
		);

		// Generate human-readable text from merged turns
		const transcriptText = processedArtifact.turns
			.map((turn) => `[${formatTimestamp(turn.start_ts * 1000)} - ${turn.role} (${turn.intent})] ${turn.text}`)
			.join('\n\n');

		// Save transcript.txt
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: transcriptKey,
				Body: transcriptText,
				ContentType: 'text/plain',
			})
		);
		console.log(`[MERGE] Saved polished transcript to ${transcriptKey}`);

		// Save detailed JSON artifact
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: fullJsonParamsKey,
				Body: JSON.stringify(processedArtifact, null, 2),
				ContentType: 'application/json',
			})
		);
		console.log(`[MERGE] Saved structured artifact to ${fullJsonParamsKey}`);

		if (processedArtifact.report) {
			const reportParamsKey = `${interviewFolder}/transcripts/report.json`;

			await s3Client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: reportParamsKey,
					Body: JSON.stringify(processedArtifact.report, null, 2),
					ContentType: 'application/json',
				})
			);
			console.log(`[MERGE] Saved analysis report to ${reportParamsKey}`);

			// Update Database with Report URL
			const region = process.env.AWS_REGION || 'ap-south-1';
			const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${reportParamsKey}`;

			// Extract interviewId from interviewFolder. interviewFolder is like <interview_id> or <interview_id> if it's top level.
			// The generateMergedTranscript receives `interviewFolder` as argument.
			// In processAudioChunk: `const interviewFolder = parts.slice(0, audioIndex).join('/');`
			// If path is `<interview_id>/audio/...`, interviewFolder is `<interview_id>`.

			try {
				const interviewId = interviewFolder.split('/')[0]; // Assuming interviewFolder is "uuid" or "uuid/something" if nested
				if (interviewId) {
					await sql`
                        UPDATE interview 
                        SET report_s3_url = ${s3Url} 
                        WHERE id = ${interviewId}
                    `;
					console.log(`[DB] Updated interview ${interviewId} with report URL: ${s3Url}`);

					// Notify Users via Email (Recruiters/Interviewers only)
					try {
						// Fetch participants who are internal users
						const participants = (await sql`
                            SELECT
                                c.name as candidate_name,
                                p.title as position_title,
                                u.email as user_email
                            FROM interview i
                            LEFT JOIN candidate c ON i.candidate_id = c.id
                            LEFT JOIN position p ON i.position_id = p.id
                            LEFT JOIN interview_participant ip ON i.id = ip.interview_id
                            INNER JOIN user_account u ON ip.user_id = u.id
                            WHERE i.id = ${interviewId}
                            AND u.role IN ('recruiter', 'interviewer', 'admin')
                        `) as any[];

						if (participants && participants.length > 0) {
							const { candidate_name, position_title } = participants[0];
							// Ensure we only collect user_emails, filtering out any potential nulls
							const uniqueEmails = [
								...new Set(participants.map((p) => p.user_email).filter((e) => e && typeof e === 'string')),
							];

							console.log(
								`[EMAIL] Sending report notification to ${uniqueEmails.length} recruiters/interviewers for ${candidate_name}`
							);

							for (const email of uniqueEmails) {
								await sendReportReadyEmail(
									email,
									candidate_name || 'Candidate',
									position_title || 'Position',
									interviewId
								);
							}
						}
					} catch (notifyErr) {
						console.error('[EMAIL] Failed to send report notification:', notifyErr);
					}
				}
			} catch (err) {
				console.error('[DB] Failed to update interview with report URL:', err);
			}
		}

		return processedArtifact;
	} catch (e) {
		console.error(`[MERGE] Error merging transcripts for ${interviewFolder}:`, e);
	}
}

async function handleSessionEnd(interviewId: string, interviewType?: string) {
	const S3_BUCKET = process.env.AWS_S3_BUCKET;
	if (!S3_BUCKET) {
		console.error('[SessionEnd] AWS_S3_BUCKET not set');
		return;
	}

	// 1. Force a final merge of the transcript to ensure consistency
	// Pass interviewType to enable AI analysis for this final merge
	console.log(
		`[SessionEnd] Performing final transcript merge for ${interviewId} (Type: ${interviewType || 'unknown/skip'})`
	);
	const finalArtifact = await generateMergedTranscript(S3_BUCKET, interviewId, interviewType);

	// 2. Previously notified transcript worker, now processing locally.
	// The artifact is already printed above.
	// Future: Add AI analysis or other post-processing here using `finalArtifact`.
	if (finalArtifact) {
		console.log(`\n${'='.repeat(60)}`);
		console.log(`FINAL TRANSCRIPT + REPORT JSON for Interview: ${interviewId}`);
		console.log(`${'='.repeat(60)}`);
		console.log(JSON.stringify(finalArtifact, null, 2));
		console.log(`${'='.repeat(60)}\n`);

		console.log(`[SessionEnd] Transcript ready for local processing/AI analysis.`);
	} else {
		console.warn(`[SessionEnd] Could not generate final transcript artifact for ${interviewId}`);
	}
	// Future: Add AI analysis or other post-processing here using `finalArtifact`.
	if (finalArtifact) {
		console.log(`[SessionEnd] Transcript ready for local processing/AI analysis.`);
	}
}

startSQSConsumer();
