import OpenAI from 'openai';
import type { QASpan, Turn, Evidence, HireSignal, CompetencySummary, ReportArtifact } from './types';

// Competency Maps (Hardcoded for now as per plan)
const COMPETENCY_MAP: Record<string, string[]> = {
	screening: ['Communication', 'Basic Technical Knowledge', 'Cultural Fit'],
	technical: ['Coding', 'Problem Solving', 'Data Structures', 'Debugging'],
	system_design: ['Architecture', 'Scalability', 'Trade-offs', 'Database Design'],
	behavioral: ['Leadership', 'Conflict Resolution', 'Growth Mindset', 'Ownership'],
	// Default fallback
	unknown: ['General Competence', 'Communication'],
};

const DEFAULT_COMPETENCIES = ['Communication', 'Problem Solving'];

function getCompetencies(interviewType: string): string[] {
	const key = interviewType.toLowerCase().replace(/\s+/g, '_');
	// Try exact match
	if (COMPETENCY_MAP[key]) return COMPETENCY_MAP[key]!;

	// Fallback logic
	if (key.includes('screen')) return COMPETENCY_MAP['screening']!;
	if (key.includes('behav')) return COMPETENCY_MAP['behavioral']!;
	if (key.includes('system') || key.includes('design')) return COMPETENCY_MAP['system_design']!;
	if (key.includes('tech') || key.includes('code')) return COMPETENCY_MAP['technical']!;

	return DEFAULT_COMPETENCIES;
}

export async function extractEvidence(openai: OpenAI, spans: QASpan[], interviewType: string): Promise<Evidence[]> {
	// Filter evaluable spans
	const evaluableSpans = spans.filter((s) => s.signal_confidence >= 0.4); // User said "if < THRESHOLD... evaluable=false"
	// We treat low signal spans as non-evaluable for evidence extraction to avoid hallucination

	if (evaluableSpans.length === 0) return [];

	const competencies = getCompetencies(interviewType);
	const allEvidence: Evidence[] = [];

	// We can batch spans or process individually.
	// For "tight scope" prompt, processing meaningful Question-Answer pairs is best.

	// const BATCH_SIZE = 5; // Unused for now

	for (const span of evaluableSpans) {
		// We run prompt for each span x relevant competencies?
		// Or ask LLM to extract ANY of the competencies found in the span?
		// User said: "For each evaluable span, for each eligible competency... Ask ONLY: What evidence... risks..."
		// Doing one LLM call per span to extract evidence for ALL relevant competencies is more efficient.

		const prompt = `
You are an expert interviewer helper. analyze the following Q&A exchange from a "${interviewType}" interview.
Identify evidence for the following competencies: ${competencies.join(', ')}.

Question: "${span.question}"
Answer: "${span.answer}"

Instructions:
1. For each competency, if evidence exists, extract it.
2. If NO evidence exists for a competency in this specific span, ignore it.
3. Identify any risks observed.
4. Do NOT use adjectives like "strong" or "weak". Be factual.
5. Do NOT make a hire/no-hire decision.
6. Return a JSON object with a "results" key containing an array of objects.
   Each object must have keys: "competency", "evidence", "risk", "confidence_weight" (0.0-1.0 based on clarity of signal).

Output JSON only.
`;

		try {
			const completion = await openai.chat.completions.create({
				model: 'gpt-4o', // Or gpt-4o, using a capable model
				messages: [
					{ role: 'system', content: 'You are a precise analyzer of interview transcripts. Output valid JSON.' },
					{ role: 'user', content: prompt },
				],
				response_format: { type: 'json_object' },
				temperature: 0.1, // Deterministic
			});

			const content = completion.choices[0]?.message?.content;
			if (content) {
				const parsed = JSON.parse(content);
				const results = parsed.results || parsed.evidence || [];
				if (Array.isArray(results)) {
					allEvidence.push(...results);
				}
			}
		} catch (err) {
			console.error(`Error analyzing span ${span.span_id}:`, err);
		}
	}

	return allEvidence;
}

export async function generateHireSignal(
	openai: OpenAI,
	evidence: Evidence[],
	interviewType: string
): Promise<HireSignal> {
	const competencies = getCompetencies(interviewType);

	// Aggregation
	const competencyMap = new Map<string, { evidence: string[]; risks: string[]; totalWeight: number; count: number }>();

	competencies.forEach((c) => competencyMap.set(c, { evidence: [], risks: [], totalWeight: 0, count: 0 }));

	// Fill map
	for (const item of evidence) {
		// Normalize competency name match
		const key = competencies.find((c) => c.toLowerCase() === item.competency.toLowerCase()) || item.competency;

		if (!competencyMap.has(key)) {
			// New competency discovered? Or hallucinated?
			// User said "eligible competency". We should probably accept what LLM found if it maps closely.
			// For now, only track expected competencies or add new ones?
			competencyMap.set(key, { evidence: [], risks: [], totalWeight: 0, count: 0 });
		}

		const entry = competencyMap.get(key)!;
		if (item.evidence) entry.evidence.push(item.evidence);
		if (item.risk) entry.risks.push(item.risk);
		entry.totalWeight += item.confidence_weight;
		entry.count++;
	}

	// Summarize
	const breakdown: CompetencySummary[] = [];
	let competenciesObserved = 0;

	for (const [comp, data] of competencyMap.entries()) {
		const hasSignal = data.count > 0;
		if (hasSignal) competenciesObserved++;

		breakdown.push({
			competency: comp,
			status: hasSignal ? (data.risks.length > data.evidence.length ? 'conflict' : 'observed') : 'insufficient',
			confidence: data.count > 0 ? data.totalWeight / data.count : 0,
			evidence_referenced: [], // We don't have span IDs in Evidence struct yet, simplified for now
		});
	}

	// Coverage
	const coverage = competencies.length > 0 ? competenciesObserved / competencies.length : 0;

	// Signal
	let hireSignal: HireSignal['hire_signal'] = 'inconclusive';
	let notes = '';

	const totalRisks = Array.from(competencyMap.values()).reduce((sum, d) => sum + d.risks.length, 0);
	const totalEvidence = Array.from(competencyMap.values()).reduce((sum, d) => sum + d.evidence.length, 0);

	if (coverage < 0.5) {
		hireSignal = 'inconclusive';
		notes = 'Insufficient signal coverage.';
	} else {
		// Simple logic for Demo:
		// If risks are low and evidence is high -> Hire
		if (totalRisks === 0 && totalEvidence > 5) {
			hireSignal = 'strong_hire';
		} else if (totalRisks < 2 && totalEvidence > 3) {
			hireSignal = 'hire';
		} else if (totalRisks > 3) {
			hireSignal = 'no_hire';
		} else {
			hireSignal = 'inconclusive';
			notes = 'Mixed signals observed.';
		}
	}

	// Confidence of the report
	const overallConfidence = breakdown.reduce((sum, b) => sum + b.confidence, 0) / (breakdown.length || 1);

	// Generate Summary using LLM
	let summary = '';
	try {
		const summaryPrompt = `
You are an expert technical recruiter. Based on the following extracted evidence from a "${interviewType}" interview, evaluate the candidate.

Competency Breakdown:
${JSON.stringify(breakdown, null, 2)}

Evidence & Risks:
${JSON.stringify(Object.fromEntries(competencyMap), null, 2)}

Overall Signal: ${hireSignal}

Task: Write a concise, 2-3 sentence summary of the candidate's performance. Highlight key strengths and any major red flags. Be professional and objective.
`;

		const completion = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: 'You are a precise technical recruiter helper.' },
				{ role: 'user', content: summaryPrompt },
			],
			temperature: 0.3,
			max_tokens: 150,
		});

		summary = completion.choices[0]?.message?.content?.trim() || notes;
	} catch (e) {
		console.error('Failed to generate summary:', e);
		summary = notes;
	}

	return {
		hire_signal: hireSignal,
		confidence: Number(overallConfidence.toFixed(2)),
		coverage: Number(coverage.toFixed(2)),
		notes: notes.trim(),
		competency_breakdown: breakdown,
		summary,
	};
}
