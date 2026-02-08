import { v4 as uuidv4 } from 'uuid';

export interface TranscriptPart {
	start_ts: number;
	end_ts: number;
	speaker_id: string;
	role: string;
	text: string;
	asr_confidence: number;
}

export interface Turn {
	turn_id: string;
	speaker_id: string;
	role: string;
	text: string;
	start_ts: number;
	end_ts: number;
	avg_confidence: number;
}

export interface QASpan {
	span_id: string;
	question_turn_id: string;
	answer_turn_ids: string[];
	question: string;
	answer: string;
	start_ts: number;
	end_ts: number;
}

export interface TranscriptArtifact {
	raw_segment_count: number;
	canonical_segment_count: number;
	turns: Turn[];
	qa_spans: QASpan[];
	metadata: {
		processed_at: string;
		total_duration: number;
	};
}

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
function mergeTurns(segments: TranscriptPart[]): Turn[] {
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
	};
}

// Step 4 & 5: Detect Questions and Construct Q -> A Spans
function constructQASpans(turns: Turn[]): QASpan[] {
	const spans: QASpan[] = [];

	// Heuristics for questions
	const questionWords = new Set([
		'how',
		'what',
		'why',
		'when',
		'where',
		'who',
		'which',
		'can',
		'could',
		'would',
		'do',
		'does',
		'is',
		'are',
		'tell',
	]);

	for (let i = 0; i < turns.length; i++) {
		const turn = turns[i];

		if (!turn) continue;

		// Only Interviewers ask questions (mostly)
		// Or try to infer if role is missing/wrong?
		// "Re-label roles correctly... explicit... or post-hoc"
		// For now, we assume 'interviewer' role or try to detect question intent

		const cleanText = turn.text.trim().toLowerCase();
		const endsWithQuestionMark = turn.text.trim().endsWith('?');
		const startsWithQuestionWord = questionWords.has(cleanText.split(' ')[0] || '');

		// Is this a question?
		const isQuestion =
			(turn.role === 'interviewer' || turn.role === 'unknown') && (endsWithQuestionMark || startsWithQuestionWord);

		if (isQuestion) {
			// Look ahead for answers
			const answers: string[] = [];
			const answerTurnIds: string[] = [];
			let j = i + 1;
			let spanEndTs = turn.end_ts;

			while (j < turns.length) {
				const nextTurn = turns[j];

				if (!nextTurn) break;

				// Stop if next turn is another question from interviewer
				// OR if speaker is same as questioner (monologue continuation?)
				// OR if speaker is explicitly interviewer again

				const isNextInterviewer = nextTurn.role === 'interviewer' || nextTurn.speaker_id === turn.speaker_id;

				if (isNextInterviewer) {
					// Check if this acts as a new question anchor
					const nextClean = nextTurn.text.trim().toLowerCase();
					const nextIsQuestion = nextClean.endsWith('?') || questionWords.has(nextClean.split(' ')[0] || '');
					if (nextIsQuestion) {
						break; // New question starts
					}
					// Else it might be a comment/backchannel, treat as part of interaction or stop?
					// User: "Stop when interviewer meaningfully speaks again"
					// We'll simplistic heuristic: if interviewer speaks for > 2 seconds, it breaks the answer
					if (nextTurn.end_ts - nextTurn.start_ts > 2.0) {
						break;
					}
				}

				// It's a candidate answer (or assumed answer)
				answers.push(nextTurn.text);
				answerTurnIds.push(nextTurn.turn_id);
				spanEndTs = nextTurn.end_ts;
				j++;
			}

			if (answers.length > 0) {
				spans.push({
					span_id: uuidv4(),
					question_turn_id: turn.turn_id,
					answer_turn_ids: answerTurnIds,
					question: turn.text,
					answer: answers.join(' '),
					start_ts: turn.start_ts,
					end_ts: spanEndTs,
				});

				// Skip efficiently
				i = j - 1;
			}
		}
	}
	return spans;
}

export function processTranscript(rawSegments: TranscriptPart[]): TranscriptArtifact {
	// 1. Deduplicate
	const canonical = deduplicateSegments(rawSegments);

	// 2. Merge Turns
	const turns = mergeTurns(canonical);

	// 3. (Implicit) Role Check - can't do much without external data,
	// but we respect what's passed in the segments.
	// If all roles are interviewer, QA Span logic handles it via heuristic checks.

	// 4 & 5. Q/A Spans
	const spans = constructQASpans(turns);

	const firstTurn = turns[0];
	const lastTurn = turns[turns.length - 1];
	const totalDuration = firstTurn && lastTurn ? lastTurn.end_ts - firstTurn.start_ts : 0;

	return {
		raw_segment_count: rawSegments.length,
		canonical_segment_count: canonical.length,
		turns: turns,
		qa_spans: spans,
		metadata: {
			processed_at: new Date().toISOString(),
			total_duration: totalDuration,
		},
	};
}
