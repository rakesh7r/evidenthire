import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import type { TranscriptArtifact, QASpan, Evidence } from './types';
import 'dotenv/config';

// Initialize Clients
const qdrant = new QdrantClient({
	url: process.env.QDRANT_URL,
	apiKey: process.env.QDRANT_API_KEY,
});

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// Constants
const EMBEDDING_MODEL = 'text-embedding-3-small';
const QA_COLLECTION = 'qa_spans_vectors';
const EVIDENCE_COLLECTION = 'evidence_vectors';
const VECTOR_SIZE = 1536;

// Types for Indexing
export interface IndexingMetadata {
	organizationId: string;
	positionId: string;
	candidateId: string;
	interviewId: string;
	interviewType: string;
}

// Generate Embedding Helper
async function generateEmbedding(text: string): Promise<number[]> {
	try {
		const response = await openai.embeddings.create({
			model: EMBEDDING_MODEL,
			input: text.replace(/\n/g, ' '),
		});
		const data = response.data[0];
		return data ? data.embedding : [];
	} catch (e) {
		console.error('Error generating embedding:', e);
		return [];
	}
}

// Ensure Collections Exist
export async function ensureCollections() {
	const collections = await qdrant.getCollections();
	const names = collections.collections.map((c) => c.name);

	// 1. QA Spans Collection
	if (!names.includes(QA_COLLECTION)) {
		console.log(`Creating collection: ${QA_COLLECTION}`);
		await qdrant.createCollection(QA_COLLECTION, {
			vectors: {
				size: VECTOR_SIZE,
				distance: 'Cosine',
			},
		});
		// Create Payload Indexes
		const fields = [
			'organization_id',
			'position_id',
			'interview_type',
			'candidate_id',
			'interview_id',
			'signal_confidence',
		];
		for (const field of fields) {
			await qdrant.createPayloadIndex(QA_COLLECTION, {
				field_name: field,
				field_schema: 'keyword', // or integer/float where approp, but keyword is safe for IDs
			});
		}
	}

	// 2. Evidence Collection
	if (!names.includes(EVIDENCE_COLLECTION)) {
		console.log(`Creating collection: ${EVIDENCE_COLLECTION}`);
		await qdrant.createCollection(EVIDENCE_COLLECTION, {
			vectors: {
				size: VECTOR_SIZE,
				distance: 'Cosine',
			},
		});
		// Create Payload Indexes
		const fields = ['organization_id', 'position_id', 'candidate_id', 'competency', 'confidence_weight'];
		for (const field of fields) {
			await qdrant.createPayloadIndex(EVIDENCE_COLLECTION, {
				field_name: field,
				field_schema: 'keyword',
			});
		}
	}
}

// Index Interview Artifact
export async function indexInterviewArtifact(artifact: TranscriptArtifact, metadata: IndexingMetadata) {
	if (!process.env.QDRANT_URL || !process.env.OPENAI_API_KEY) {
		console.warn('Skipping indexing: Missing QDRANT_URL or OPENAI_API_KEY');
		return;
	}

	await ensureCollections();

	// 1. Index QA Spans
	const qaPoints: any[] = [];
	console.log(`Indexing ${artifact.qa_spans.length} QA spans...`);

	for (const span of artifact.qa_spans) {
		const text = `Question: ${span.question}\nAnswer: ${span.answer}`;
		const vector = await generateEmbedding(text);

		if (vector.length > 0) {
			qaPoints.push({
				id: span.span_id,
				vector: vector,
				payload: {
					organization_id: metadata.organizationId,
					position_id: metadata.positionId,
					interview_type: metadata.interviewType,
					candidate_id: metadata.candidateId,
					interview_id: metadata.interviewId,
					question_id: span.span_id, // using span_id as question_id
					signal_confidence: span.signal_confidence,
					start_ts: span.start_ts,
					end_ts: span.end_ts,
					question: span.question,
					answer: span.answer,
				},
			});
		}
	}

	if (qaPoints.length > 0) {
		try {
			await qdrant.upsert(QA_COLLECTION, {
				wait: true,
				points: qaPoints,
			});
			console.log(`Upserted ${qaPoints.length} QA vectors.`);
		} catch (e) {
			console.error(`Failed to upsert QA vectors:`, e);
		}
	}

	// 2. Index Evidence
	if (artifact.report && artifact.report.evidence) {
		const evPoints: any[] = [];
		console.log(`Indexing ${artifact.report.evidence.length} evidence items...`);

		let evIdx = 0;
		for (const ev of artifact.report.evidence) {
			const text = `Competency: ${ev.competency}\nEvidence: ${ev.evidence}\nRisk: ${ev.risk || 'none'}`;
			const vector = await generateEmbedding(text);

			if (vector.length > 0) {
				const evId = `${metadata.interviewId}-ev-${evIdx++}`; // Deterministic ID
				evPoints.push({
					id: evId, // We might need UUID here? Qdrant accepts string-uuids or integers.
					// Ideally we use uuid v5 or v4. But simple string ID is supported if using Qdrant properly?
					// The Qdrant JS client usually expects UUIDs for points if not using integers.
					// But let's check if the client auto-hashes strings.
					// Actually, strictly speaking `id` should be UUID or uint64.
					// We should generate a UUID.

					// For now, let's assume UUID generation is needed or let's use a uuid package if available.
					// audio-worker has `uuid` package dependency.
					vector: vector,
					payload: {
						organization_id: metadata.organizationId,
						position_id: metadata.positionId,
						candidate_id: metadata.candidateId,
						interview_id: metadata.interviewId,
						competency: ev.competency,
						confidence_weight: ev.confidence_weight,
						evidence: ev.evidence,
						risk: ev.risk,
					},
				});
			}
		}

		if (evPoints.length > 0) {
			// Fix IDs to be UUIDs using UUID v5 or similar if strictness required.
			// For now, let's use the uuid package.
			const { v4: uuidv4 } = require('uuid');
			evPoints.forEach((p) => (p.id = uuidv4()));

			try {
				await qdrant.upsert(EVIDENCE_COLLECTION, {
					wait: true,
					points: evPoints,
				});
				console.log(`Upserted ${evPoints.length} Evidence vectors.`);
			} catch (e) {
				console.error(`Failed to upsert Evidence vectors:`, e);
			}
		}
	}
}
