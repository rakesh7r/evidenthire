import { processTranscript } from '../transcript-processor';
import type { TranscriptPart, TranscriptArtifact } from '../types';
import { extractEvidence, generateHireSignal } from '../evidence-extractor';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const rawTranscriptText = `
[00:00:00.000 - interviewer (question)] Can you start by giving a quick overview of your experience as a frontend and backend engineer?

[00:00:28.000 - candidate (answer)] Sure. I have around eight years of experience overall. On the frontend side, I mostly work with React, including hooks, context, and performance optimization. On the backend, I primarily use Node.js with Express and sometimes NestJS. I have also worked extensively with AWS services and containerized deployments.

[01:05:10.000 - interviewer (question)] Let’s start with React. How do you manage state in a large-scale frontend application?

[01:25:30.000 - candidate (answer)] In smaller components, I prefer using local state with useState and useReducer. For larger applications, I usually rely on Redux Toolkit or React Query for server state. I also try to colocate state as close to where it’s used as possible to avoid unnecessary re-renders.

[02:10:40.000 - interviewer (question)] How do you handle performance optimization in React?

[02:28:00.000 - candidate (answer)] I look at memoization using React.memo, useCallback, and useMemo where required. I also focus on avoiding unnecessary renders, splitting code using lazy loading, and optimizing lists with techniques like virtualization when dealing with large datasets.

[03:15:20.000 - interviewer (question)] Moving to the backend, how do you structure a Node.js application for production?

[03:34:10.000 - candidate (answer)] I usually follow a layered architecture. Routes handle request validation, controllers manage request flow, services contain business logic, and repositories handle database access. This separation makes the system easier to test and scale.

[04:20:00.000 - interviewer (question)] How do you handle asynchronous operations and errors in Node.js?

[04:35:40.000 - candidate (answer)] I mostly use async and await with centralized error handling middleware. For promises, I avoid deeply nested logic and ensure proper try-catch blocks. Logging errors with correlation IDs is also important in production systems.

[05:20:30.000 - interviewer (question)] Can you explain how you’ve used AWS in your projects?

[05:38:10.000 - candidate (answer)] I’ve used AWS EC2 for compute, S3 for object storage, RDS and DynamoDB for databases, and IAM for access control. For scalable systems, I’ve also used load balancers, auto-scaling groups, and CloudWatch for monitoring.

[06:25:00.000 - interviewer (question)] How do Docker and Kubernetes fit into your workflow?

[06:42:20.000 - candidate (answer)] Docker is used to containerize applications so that environments are consistent. Kubernetes helps with orchestration, scaling, and self-healing. I usually define deployments, services, and config maps, and use Helm charts for managing configurations across environments.

[07:35:10.000 - interviewer (question)] What challenges have you faced while working with Kubernetes?

[07:50:40.000 - candidate (answer)] Debugging can be challenging, especially around networking and resource limits. Misconfigured readiness or liveness probes can also cause instability. Observability using logs and metrics is critical to troubleshoot issues effectively.

[08:40:00.000 - interviewer (question)] Let’s talk about CI/CD. What does a typical pipeline look like for you?

[08:56:30.000 - candidate (answer)] A typical pipeline includes code linting, unit tests, build steps, and container image creation. After that, the image is pushed to a registry and deployed to staging or production using automated scripts. Rollbacks and environment-specific configurations are also part of the setup.

[09:50:20.000 - interviewer (question)] How do you ensure code quality and reliability in such pipelines?

[10:05:40.000 - candidate (answer)] I rely on automated tests, static code analysis, and mandatory code reviews. Feature flags help reduce risk during releases, and monitoring after deployment ensures that issues are detected early.

[10:55:00.000 - interviewer (other)] Thank you. That will be all for today.

[11:00:00.000 - candidate (other)] Thank you for the opportunity.
`;

function parseTimestamp(ts: string): number {
	// Format: HH:MM:SS.mmm
	if (!ts) return 0;
	const parts = ts.split(':');
	if (parts.length < 3) return 0;

	const [h, m, s_ms] = parts;
	if (!s_ms) return 0;

	const secParts = s_ms.split('.');
	const s = secParts[0] || '0';
	const ms = secParts[1] || '0';

	return parseInt(h || '0') * 3600 + parseInt(m || '0') * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function parseTranscript(text: string): TranscriptPart[] {
	const lines = text.trim().split('\n\n');
	const parts: TranscriptPart[] = [];

	for (const line of lines) {
		const match = line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3}) - (\w+) \((\w+)\)\] (.*)$/s);
		if (match && match.length >= 5) {
			const timestamp = match[1];
			const role = match[2];
			// const intent = match[3];
			const content = match[4];

			if (!timestamp || !role || !content) continue;

			const startTs = parseTimestamp(timestamp);
			const speakerId = role === 'interviewer' ? 'interviewer@evident.com' : 'rakeshgandla202@gmail.com';

			parts.push({
				start_ts: startTs,
				end_ts: startTs + 5, // Placeholder
				speaker_id: speakerId,
				role: role,
				text: content.replace(/\n/g, ' '),
				asr_confidence: 0.98,
			});
		}
	}

	// Fix end timestamps
	for (let i = 0; i < parts.length - 1; i++) {
		const nextPart = parts[i + 1];
		if (nextPart) {
			parts[i].end_ts = nextPart.start_ts - 0.5;
		}
	}

	const lastPart = parts[parts.length - 1];
	if (lastPart) {
		lastPart.end_ts = lastPart.start_ts + 2.0;
	}

	return parts;
}

async function runTest() {
	console.log('Parsing raw transcript...');
	const rawSegments = parseTranscript(rawTranscriptText);
	console.log(`Parsed ${rawSegments.length} segments.`);

	console.log('Processing transcript...');
	const processed = processTranscript(rawSegments);

	console.log('--- Processing Report ---');
	console.log(`Raw Segments: ${processed.raw_segment_count}`);
	console.log(`Canonical Segments: ${processed.canonical_segment_count}`);
	console.log(`Turns: ${processed.turns.length}`);
	console.log(`QA Spans: ${processed.qa_spans.length}`);

	console.log('\n--- QA Spans ---');
	processed.qa_spans.forEach((span, idx) => {
		console.log(`\nSpan #${idx + 1} (Signal Conf: ${span.signal_confidence})`);
		console.log(`Q: ${span.question}`);
		console.log(`A: ${span.answer.substring(0, 50)}... [Length: ${span.answer.length}]`);
	});

	// Validations
	let passed = true;
	if (processed.qa_spans.length === 0) {
		console.error('FAIL: No QA spans detected!');
		passed = false;
	}

	// Check specific known QA pairs
	const firstSpan = processed.qa_spans[0];
	if (!firstSpan) {
		console.error('FAIL: No first span found');
		passed = false;
	} else if (!firstSpan.question.includes('overview of your experience')) {
		console.error('FAIL: First span question mismatch');
		passed = false;
	} else {
		console.log('PASS: First QA Span identified correctly.');
	}

	// Check classification of intents
	const questionTurns = processed.turns.filter((t) => t.intent === 'question');
	const answerTurns = processed.turns.filter((t) => t.intent === 'answer');

	console.log(`Classified Questions: ${questionTurns.length}`);
	console.log(`Classified Answers: ${answerTurns.length}`);

	if (questionTurns.length < 8) {
		console.warn('WARN: Detected fewer questions than expected (expected ~10).');
	}

	// --- AI Analysis Phase ---
	const apiKey = process.env.OPENAI_API_KEY;
	if (apiKey) {
		console.log('\n--- Running AI Analysis ---');
		const openai = new OpenAI({ apiKey });

		try {
			console.log('Extracting Evidence...');
			const evidence = await extractEvidence(openai, processed.qa_spans, 'software_engineer');
			console.log(`Extracted ${evidence.length} evidence items.`);
			evidence.forEach((e) => console.log(`- [${e.competency}]: ${e.risk} (Conf: ${e.confidence_weight})`));

			console.log('Generating Hire Signal...');
			const report = await generateHireSignal(openai, evidence, 'software_engineer');
			console.log(`\nHire Signal: ${report.hire_signal.toUpperCase()} (Confidence: ${report.confidence})`);
			console.log('Summary:', report.summary || report.notes);

			// Attach report to the artifact
			processed.report = {
				evidence: evidence,
				hire_signal: report,
			};

			if (report.hire_signal === 'hire' || report.hire_signal === 'strong_hire') {
				console.log('PASS: Positive hire signal generated as expected for a strong candidate.');
			} else {
				console.warn(`WARN: Unexpected hire signal: ${report.hire_signal}`);
			}
		} catch (error) {
			console.error('AI Analysis Failed:', error);
			passed = false;
		}
	} else {
		console.log('\n⚠️  Skipping AI Analysis: OPENAI_API_KEY not found in environment.');
	}

	// Save Results to File
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `test_results_${timestamp}.json`;
	const outputPath = path.join(__dirname, filename);

	try {
		fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));
		console.log(`\n📄 Saved detailed test results to: ${outputPath}`);
	} catch (err) {
		console.error('\n❌ Failed to save test results file:', err);
	}

	if (passed) {
		console.log('\n✅ TEST PASSED: Transcript processing flow validates successfully.');
	} else {
		console.log('\n❌ TEST FAILED');
		process.exit(1);
	}
}

runTest();
