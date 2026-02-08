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
	intent: 'question' | 'answer' | 'other';
}

export interface QASpan {
	span_id: string;
	question_turn_id: string;
	answer_turn_ids: string[];
	question: string;
	answer: string;
	start_ts: number;
	end_ts: number;
	signal_confidence: number;
}

export interface Evidence {
	competency: string;
	evidence: string;
	risk: string;
	confidence_weight: number;
}

export interface CompetencySummary {
	competency: string;
	status: 'observed' | 'insufficient' | 'conflict';
	confidence: number;
	evidence_referenced: string[]; // List of span_ids
}

export interface HireSignal {
	hire_signal: 'strong_hire' | 'hire' | 'inconclusive' | 'no_hire' | 'strong_no_hire';
	confidence: number;
	coverage: number;
	notes: string;
	competency_breakdown: CompetencySummary[];
	summary?: string;
}

export interface ReportArtifact {
	evidence: Evidence[];
	hire_signal: HireSignal;
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
	report?: ReportArtifact; // Optional analysis report
}
