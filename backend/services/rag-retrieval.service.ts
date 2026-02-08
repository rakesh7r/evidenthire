import { qdrantClient } from '../lib/qdrant';
import { generateEmbedding } from './embedding.service';
import openai from '../lib/openai';
import logger from '../lib/logger';

const QA_COLLECTION = 'qa_spans_vectors';
const EVIDENCE_COLLECTION = 'evidence_vectors';

export interface RAGFilters {
	organizationId: string;
	positionId?: string;
	candidateId?: string;
	interviewId?: string;
	interviewType?: string;
}

export interface RetrievedContext {
	id: string;
	text: string;
	type: 'qa' | 'evidence';
	score: number;
	finalScore: number;
	metadata: any;
}

/**
 * Search QA Spans with metadata filtering and confidence re-ranking
 */
async function searchQASpans(
	queryVector: number[],
	filters: RAGFilters,
	limit: number = 10
): Promise<RetrievedContext[]> {
	try {
		const must: any[] = [{ key: 'organization_id', match: { value: filters.organizationId } }];

		if (filters.positionId) must.push({ key: 'position_id', match: { value: filters.positionId } });
		if (filters.candidateId) must.push({ key: 'candidate_id', match: { value: filters.candidateId } });
		if (filters.interviewId) must.push({ key: 'interview_id', match: { value: filters.interviewId } });
		if (filters.interviewType) must.push({ key: 'interview_type', match: { value: filters.interviewType } });

		const results = await qdrantClient.search(QA_COLLECTION, {
			vector: queryVector,
			filter: { must },
			limit: limit * 2, // Fetch more for re-ranking
			with_payload: true,
		});

		return results.map((r) => {
			const p = r.payload || {};
			const confidence = typeof p.signal_confidence === 'number' ? p.signal_confidence : 0.5;
			// Re-ranking: score * confidence
			const finalScore = r.score * confidence;

			return {
				id: r.id as string,
				text: `Question: ${p.question}\nAnswer: ${p.answer}`, // Reconstruct text presentation
				type: 'qa',
				score: r.score,
				finalScore,
				metadata: p,
			};
		});
	} catch (e) {
		logger.error({ error: String(e) }, 'Error searching QA spans');
		return [];
	}
}

/**
 * Search Evidence with metadata filtering and confidence re-ranking
 */
async function searchEvidence(
	queryVector: number[],
	filters: RAGFilters,
	limit: number = 10
): Promise<RetrievedContext[]> {
	try {
		const must: any[] = [{ key: 'organization_id', match: { value: filters.organizationId } }];

		if (filters.positionId) must.push({ key: 'position_id', match: { value: filters.positionId } });
		if (filters.candidateId) must.push({ key: 'candidate_id', match: { value: filters.candidateId } });
		if (filters.interviewId) must.push({ key: 'interview_id', match: { value: filters.interviewId } });

		const results = await qdrantClient.search(EVIDENCE_COLLECTION, {
			vector: queryVector,
			filter: { must },
			limit: limit * 2,
			with_payload: true,
		});

		return results.map((r) => {
			const p = r.payload || {};
			const confidence = typeof p.confidence_weight === 'number' ? p.confidence_weight : 0.5;
			// Re-ranking: score * confidence
			const finalScore = r.score * confidence;

			return {
				id: r.id as string,
				text: `Competency: ${p.competency}\nEvidence: ${p.evidence}\nRisk: ${p.risk || 'none'}`,
				type: 'evidence',
				score: r.score,
				finalScore,
				metadata: p,
			};
		});
	} catch (e) {
		// If collection doesn't exist yet, it throws. Handle gracefully.
		logger.error({ error: String(e) }, 'Error searching Evidence');
		return [];
	}
}

/**
 * Main Retrieval Function
 */
export async function retrieveContext(
	query: string,
	filters: RAGFilters,
	limit: number = 8
): Promise<RetrievedContext[]> {
	const queryVector = await generateEmbedding(query);
	if (!queryVector.length) return [];

	const [qaResults, evidenceResults] = await Promise.all([
		searchQASpans(queryVector, filters, limit),
		searchEvidence(queryVector, filters, limit),
	]);

	// Combine and Sort by Final Score
	const combined = [...qaResults, ...evidenceResults];
	combined.sort((a, b) => b.finalScore - a.finalScore);

	// Initial Filter: Remove very low signals (threshold e.g. 0.4 final score?)
	// Or just top N.
	// Prompt says: "Results below confidence threshold must be marked 'low signal'".
	return combined.slice(0, limit);
}

/**
 * Generation Function
 */
export async function generateRAGResponse(query: string, context: RetrievedContext[]): Promise<string> {
	if (context.length === 0) {
		return "I couldn't find any relevant information in the interview data with sufficient confidence.";
	}

	// Format Context
	const contextStr = context
		.map((c) => {
			let label = c.finalScore < 0.35 ? '[LOW CONFIDENCE] ' : ''; // Arbitrary threshold
			return `${label}[${c.type.toUpperCase()}] (Score: ${c.finalScore.toFixed(2)})\n${c.text}`;
		})
		.join('\n---\n');

	const systemPrompt = `
You are a specialized recruitment assistant. You MUST answer based ONLY on the provided Context.
The Context includes QA transcripts and Evidence findings.

Key Rules:
1. Cite the QA or Evidence explicitly in your answer.
2. Respect confidence scores. If a piece of info is marked [LOW CONFIDENCE], mention that uncertainty.
3. If the evidence for a conclusion is missing or weak, say so. Do not hallucinate.
4. Keep answers professional, concise, and neutral.
5. If the user asks for a comparison, comparing the provided contexts is allowed.

Context:
${contextStr}
`;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: query },
			],
			temperature: 0.2, // Low temp for factualness
		});

		return response.choices[0]?.message.content || 'No response generated.';
	} catch (e) {
		logger.error({ error: String(e) }, 'Error generating RAG response');
		return 'I encountered an error generating the response.';
	}
}
