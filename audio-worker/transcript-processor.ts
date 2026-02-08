import { v4 as uuidv4 } from 'uuid';
import type { TranscriptPart, Turn, QASpan, TranscriptArtifact } from './types';

// Helper: Simple Jaccard Similarity for text
function getJaccardSimilarity(str1: string, str2: string): number {
	const set1 = new Set(str1.toLowerCase().split(/\s+/));
	const set2 = new Set(str2.toLowerCase().split(/\s+/));
	const intersection = new Set([...set1].filter((x) => set2.has(x)));
	const union = new Set([...set1, ...set2]);
	return union.size === 0 ? 0 : intersection.size / union.size;
}

// Step 1: Deduplicate + canonicalize
function deduplicateSegments(segments: TranscriptPart[]): TranscriptPart[] {
	if (segments.length === 0) return [];

	const sorted = [...segments].sort((a, b) => a.start_ts - b.start_ts);
	const canonical: TranscriptPart[] = [];

	let current = sorted[0];

	for (let i = 1; i < sorted.length; i++) {
		const next = sorted[i];

		if (!current || !next) continue; // Safety check

		// Overlap calculation
		const overlapStart = Math.max(current.start_ts, next.start_ts);
		const overlapEnd = Math.min(current.end_ts, next.end_ts);
		const overlapDuration = Math.max(0, overlapEnd - overlapStart);

		const currDur = current.end_ts - current.start_ts;
		const nextDur = next.end_ts - next.start_ts;

		const isSameSpeaker = current.speaker_id === next.speaker_id;
		const significantOverlap =
			overlapDuration > 0 && (overlapDuration / currDur > 0.5 || overlapDuration / nextDur > 0.5);

		// Check text similarity if significant overlap
		const similarity = significantOverlap ? getJaccardSimilarity(current.text, next.text) : 0;
		const highSimilarity = similarity > 0.3; // Threshold for "same content"

		if (isSameSpeaker && significantOverlap && highSimilarity) {
			// Keep the longest / most complete one
			// Heuristic: Longer text usually means more complete in Whisper
			if (next.text.length > current.text.length) {
				current = next;
			} else {
				// Keep current, ignore next
			}
		} else {
			// No merge, push current and move to next
			if (current) canonical.push(current);
			current = next;
		}
	}
	if (current) {
		canonical.push(current);
	}

	return canonical;
}

// Step 2: Merge adjacent segments into speaker turns
function mergeSegmentsToTurns(segments: TranscriptPart[]): Turn[] {
	if (segments.length === 0) return [];

	const turns: Turn[] = [];
	let currentBuffer: TranscriptPart[] = [segments[0]];

	for (let i = 1; i < segments.length; i++) {
		const prev = currentBuffer[currentBuffer.length - 1];
		const curr = segments[i];

		if (!prev || !curr) continue;

		const gap = curr.start_ts - prev.end_ts;

		// Merge if same speaker and gap is small (<= 1.5s)
		if (curr.speaker_id === prev.speaker_id && gap <= 1.5) {
			currentBuffer.push(curr);
		} else {
			// Flush buffer
			const turn = createTurnFromBuffer(currentBuffer);
			if (turn) turns.push(turn);
			currentBuffer = [curr];
		}
	}
	const finalTurn = createTurnFromBuffer(currentBuffer);
	if (finalTurn) turns.push(finalTurn);

	return turns;
}

function createTurnFromBuffer(parts: TranscriptPart[]): Turn | null {
	if (parts.length === 0) return null;
	const first = parts[0];
	const last = parts[parts.length - 1];

	if (!first || !last) return null;

	// Join text with spaces, handling potential punctuation logic if needed (simple join for now)
	const fullText = parts
		.map((p) => p.text)
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();

	const avgConf = parts.reduce((sum, p) => sum + (p.asr_confidence || 1.0), 0) / parts.length;

	return {
		turn_id: uuidv4(),
		speaker_id: first.speaker_id,
		role: first.role,
		text: fullText,
		start_ts: first.start_ts,
		end_ts: last.end_ts,
		avg_confidence: avgConf,
		intent: 'other', // Default, will be updated later
	};
}

// Phase 1 Task 1.1: Filter junk turns
function isMeaningfulTurn(turn: Turn): boolean {
	const text = turn.text.trim();
	if (text.length < 5) return false; // Too short

	// Filler List
	const fillers = new Set(['you', 'hello', 'uh', 'ok', 'okay', 'right', 'yeah', 'yep', 'hmm', 'ah']);
	const cleanText = text.toLowerCase().replace(/[^a-z\s]/g, '');

	// Check if text is just filler words (repeated or single)
	const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
	if (words.length === 0) return false;

	const allFillers = words.every((w) => fillers.has(w));
	if (allFillers) return false;

	// Check for "hello hello" repetition if strictly just fillers
	// The strict check 'allFillers' covers 'hello hello'

	return true;
}

// Phase 1 Task 1.2: Merge micro-turns
function mergeMicroTurns(turns: Turn[]): Turn[] {
	if (turns.length === 0) return [];

	const merged: Turn[] = [];
	let current = turns[0];
	if (!current) return []; // Check for undefined

	for (let i = 1; i < turns.length; i++) {
		const next = turns[i];
		if (!next) continue; // Safety check

		const gap = next.start_ts - current.end_ts;

		// Merge if same speaker, small gap, and we already know they are meaningful
		if (current.speaker_id === next.speaker_id && gap <= 1.0) {
			// Merge logic
			current.end_ts = next.end_ts; // Extend end_ts
			current.text = `${current.text} ${next.text}`;
			current.avg_confidence = (current.avg_confidence + next.avg_confidence) / 2; // Simple approx
		} else {
			merged.push(current);
			current = next;
		}
	}
	merged.push(current);
	return merged;
}

// Phase 2 Task 2.1: Classify turn intent
function classifyTurnIntents(turns: Turn[]): Turn[] {
	for (let i = 0; i < turns.length; i++) {
		const turn = turns[i];
		if (!turn) continue;

		const role = turn.role;
		const text = turn.text.trim();
		const prevTurn = i > 0 ? turns[i - 1] : null;

		if (role === 'interviewer' && text.includes('?')) {
			turn.intent = 'question';
		} else if (role === 'candidate' && prevTurn?.intent === 'question') {
			turn.intent = 'answer';
		} else {
			turn.intent = 'other';
		}
	}
	return turns;
}

// Phase 3 & 4: Build Spans & Score
function buildQASpans(turns: Turn[]): QASpan[] {
	const spans: QASpan[] = [];

	for (let i = 0; i < turns.length; i++) {
		const turn = turns[i];
		if (!turn) continue;

		if (turn.intent === 'question') {
			// Start new span
			const questionTurn = turn;
			const answers: Turn[] = [];

			let j = i + 1;
			while (j < turns.length) {
				const nextTurn = turns[j];
				// Stop if no next turn or it's a question
				if (!nextTurn || nextTurn.intent === 'question') {
					break;
				}

				// Collect candidate answers
				if (nextTurn.role === 'candidate') {
					answers.push(nextTurn);
				}

				j++;
			}

			// Edge rule: If no candidate answers -> discard span
			if (answers.length > 0) {
				const answerText = answers.map((a) => a.text).join(' ');
				const answerIds = answers.map((a) => a.turn_id);
				const spanStart = questionTurn.start_ts;
				const lastAnswer = answers[answers.length - 1]; // We know answers.length > 0
				const spanEnd = lastAnswer ? lastAnswer.end_ts : spanStart; // Fallback safe

				// Phase 4: Signal Confidence
				const candidateTime = answers.reduce((sum, a) => sum + (a.end_ts - a.start_ts), 0);
				const totalSpanTime = spanEnd - spanStart;

				const allSpanTurns = [questionTurn, ...answers];
				const avgAsr = allSpanTurns.reduce((sum, t) => sum + t.avg_confidence, 0) / allSpanTurns.length;

				// Iterruptions: check range [i+1, j]
				let interruptions = 0;
				for (let k = i + 1; k < j; k++) {
					const t = turns[k];
					if (t && t.role === 'interviewer' && t.intent !== 'question') {
						interruptions++;
					}
				}

				// Metric: "signal_confidence": 0.0 – 1.0
				const ratio = totalSpanTime > 0 ? candidateTime / totalSpanTime : 0;
				const interruptionPenalty = Math.min(0.5, interruptions * 0.1);

				let sigConf = ratio * avgAsr * (1.0 - interruptionPenalty);
				sigConf = Math.max(0, Math.min(1, sigConf)); // Clamp 0-1

				spans.push({
					span_id: uuidv4(),
					question_turn_id: questionTurn.turn_id,
					answer_turn_ids: answerIds,
					question: questionTurn.text,
					answer: answerText,
					start_ts: spanStart,
					end_ts: spanEnd,
					signal_confidence: Number(sigConf.toFixed(2)),
				});
			}

			// Optimization: Skip to where we stopped scanning
			i = j - 1;
		}
	}
	return spans;
}

export function processTranscript(rawSegments: TranscriptPart[]): TranscriptArtifact {
	// 1. Deduplicate
	const canonical = deduplicateSegments(rawSegments);

	// 2. Merge Segments to Initial Turns
	const initialTurns = mergeSegmentsToTurns(canonical);

	// Phase 1: Turn Hygiene
	// 1.1 Filter junk
	const meaningfulTurns = initialTurns.filter(isMeaningfulTurn);
	// 1.2 Merge micro-turns
	const mergedTurns = mergeMicroTurns(meaningfulTurns);

	// Phase 2: Intent Classification
	const classifiedTurns = classifyTurnIntents(mergedTurns);

	// Phase 3 & 4: Q/A Spans & Signal
	const spans = buildQASpans(classifiedTurns);

	const firstTurn = classifiedTurns[0];
	const lastTurn = classifiedTurns[classifiedTurns.length - 1];
	const totalDuration = firstTurn && lastTurn ? lastTurn.end_ts - firstTurn.start_ts : 0;

	return {
		raw_segment_count: rawSegments.length,
		canonical_segment_count: canonical.length,
		turns: classifiedTurns,
		qa_spans: spans,
		metadata: {
			processed_at: new Date().toISOString(),
			total_duration: totalDuration,
		},
	};
}
