import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { Readable } from 'stream';

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
				MaxNumberOfMessages: 5, // Process fewer to avoid rate limits
				WaitTimeSeconds: 20,
			});

			const response = await sqsClient.send(command);

			if (response.Messages && response.Messages.length > 0) {
				console.log(`Received ${response.Messages.length} messages from SQS.`);
				for (const message of response.Messages) {
					if (message.Body) {
						try {
							const s3Event = JSON.parse(message.Body);
							// Standard S3 Event Records
							if (s3Event.Records) {
								for (const record of s3Event.Records) {
									if (!record.s3 || !record.s3.bucket || !record.s3.object) continue;

									const bucket = record.s3.bucket.name;
									const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
									const size = record.s3.object.size; // We only care about audio chunks (e.g., .ts or .m4a)
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

async function processAudioChunk(bucket: string, key: string) {
	// Folder structure: position/id/date/email/chunks/file.ts
	const parts = key.split('/');
	const filename = parts.pop();
	const chunksPrefix = parts.join('/'); // .../chunks
	const playlistKey = `${chunksPrefix}/playlist.m3u8`;

	console.log(`[${key}] Starting processing...`);

	try {
		// 1. Fetch Playlist to find timestamp
		console.log(`[${key}] Fetching playlist: ${playlistKey}`);
		const playlistRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: playlistKey }));
		const playlistStr = await streamToString(playlistRes.Body as Readable);
		const segments = parseM3u8(playlistStr);

		const segment = segments.find((s) => s.uri === filename);
		const startTime = segment ? segment.startTime : 0;
		const timestamp = new Date(startTime * 1000).toISOString().substr(11, 8); // HH:MM:SS

		// 2. Fetch Audio Chunk
		console.log(`[${key}] Fetching audio chunk...`);
		const audioRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		const audioBuffer = await streamToBuffer(audioRes.Body as Readable);

		// 3. Transcribe
		let text = '';
		if (process.env.OPENAI_API_KEY) {
			// OpenAI requires specific File-like object or filename.
			// We can use the 'file' parameter with options
			// Note: converting buffer to file object for OpenAI might require 'file-type' or mocking it
			// Note: converting buffer to file object for OpenAI might require 'file-type' or mocking it
			const file = new File([audioBuffer], filename || 'audio.mp3', { type: 'audio/mpeg' });

			console.log(`[${key}] Sending to OpenAI Whisper model: ${file.name} (${file.size} bytes)`);
			const transcription = await openai.audio.transcriptions.create({
				file: file,
				model: 'whisper-1',
			});
			text = transcription.text;
		} else {
			text = `[Mock Transcription for ${filename}]`;
		}

		console.log(`Transcribed [${timestamp}]: ${text}`);

		// 4. Append to Transcript File
		// We'll store transcript in the PARENT folder (level up from chunks) or same folder?
		// "generate a transcripts text file". putting it in the 'chunks' folder usually is messy.
		// Let's put it in the candidate folder: .../email/transcript.txt
		const parentFolder = parts.slice(0, -1).join('/'); // .../email
		const transcriptKey = `${parentFolder}/transcript.txt`;

		let currentTranscript = '';
		try {
			const existing = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: transcriptKey }));
			currentTranscript = await streamToString(existing.Body as Readable);
		} catch (e) {
			// File doesn't exist yet
		}

		const newEntry = `[${timestamp}] ${text}\n`;
		const updatedTranscript = currentTranscript + newEntry;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: transcriptKey,
				Body: updatedTranscript,
				ContentType: 'text/plain',
			})
		);

		console.log(`Updated transcript: ${transcriptKey}`);
	} catch (err) {
		console.error(`Failed to process chunk ${key}:`, err);
	}
}

startSQSConsumer();
