import { qdrantClient } from '../lib/qdrant';
import { generateEmbedding, EMBEDDING_DIMENSIONS } from './embedding.service';
import logger from '../lib/logger';

/**
 * Get collection name for an organization
 */
function getCollectionName(organizationId: string): string {
	return `evidenthire_applications_${organizationId}`;
}

/**
 * Ensure collection exists for an organization
 */
export async function ensureCollection(organizationId: string): Promise<void> {
	const collectionName = getCollectionName(organizationId);

	try {
		const collections = await qdrantClient.getCollections();
		const exists = collections.collections.some((c) => c.name === collectionName);

		if (!exists) {
			await qdrantClient.createCollection(collectionName, {
				vectors: {
					size: EMBEDDING_DIMENSIONS,
					distance: 'Cosine',
				},
			});
			logger.info({ collectionName }, 'Created Qdrant collection');

			// Create payload indexes for filtering
			await qdrantClient.createPayloadIndex(collectionName, {
				field_name: 'position_id',
				field_schema: 'keyword',
			});
			await qdrantClient.createPayloadIndex(collectionName, {
				field_name: 'status',
				field_schema: 'keyword',
			});
			await qdrantClient.createPayloadIndex(collectionName, {
				field_name: 'overall_score',
				field_schema: 'integer',
			});
			logger.info({ collectionName }, 'Created Qdrant payload indexes');
		}
	} catch (error) {
		logger.error({ error: String(error), collectionName }, 'Error ensuring Qdrant collection');
		throw error;
	}
}

interface SkillMatch {
	skill: string;
	match: boolean;
}

interface ResumeMetadata {
	organizationId: string;
	positionId: string;
	applicationId: string;
	candidateName: string;
	candidateEmail: string;
	resumePreview: string;
	createdAt: string;
	status: string;
	// AI Analysis data
	overallScore?: number | null;
	skillsMatch?: SkillMatch[] | null;
	bonusSkills?: string[] | null;
	experienceScore?: number | null;
	projectsScore?: number | null;
}

/**
 * Store resume embedding in Qdrant
 */
export async function upsertResumeVector(resumeText: string, metadata: ResumeMetadata): Promise<void> {
	const collectionName = getCollectionName(metadata.organizationId);

	try {
		// Ensure collection exists
		await ensureCollection(metadata.organizationId);

		const embedding = await generateEmbedding(resumeText);

		if (embedding.length === 0) {
			logger.warn({ applicationId: metadata.applicationId }, 'Empty embedding returned, skipping vector storage');
			return;
		}

		// Extract matched and unmatched skills
		const matchedSkills: string[] = [];
		const unmatchedSkills: string[] = [];

		if (metadata.skillsMatch && Array.isArray(metadata.skillsMatch)) {
			for (const item of metadata.skillsMatch) {
				if (item.match) {
					matchedSkills.push(item.skill);
				} else {
					unmatchedSkills.push(item.skill);
				}
			}
		}

		// Upsert to Qdrant
		await qdrantClient.upsert(collectionName, {
			wait: true,
			points: [
				{
					id: metadata.applicationId,
					vector: embedding,
					payload: {
						organization_id: metadata.organizationId,
						position_id: metadata.positionId,
						application_id: metadata.applicationId,
						candidate_name: metadata.candidateName,
						candidate_email: metadata.candidateEmail,
						resume_preview: metadata.resumePreview.slice(0, 500),
						created_at: metadata.createdAt,
						status: metadata.status || 'pending',
						overall_score: metadata.overallScore ?? null,
						matched_skills: matchedSkills,
						unmatched_skills: unmatchedSkills,
						bonus_skills: metadata.bonusSkills ?? [],
						experience_score: metadata.experienceScore ?? null,
						projects_score: metadata.projectsScore ?? null,
					},
				},
			],
		});

		logger.info({ applicationId: metadata.applicationId }, 'Stored resume vector');
	} catch (error) {
		logger.error({ error: String(error), applicationId: metadata.applicationId }, 'Error storing resume vector');
		// Don't throw - vector storage failure shouldn't block application submission
	}
}

/**
 * Update application status in Qdrant
 */
export async function updateApplicationStatus(
	organizationId: string,
	applicationId: string,
	status: string
): Promise<void> {
	const collectionName = getCollectionName(organizationId);

	try {
		await qdrantClient.setPayload(collectionName, {
			points: [applicationId],
			payload: {
				status,
			},
		});
		logger.info({ applicationId, status }, 'Updated application status in Qdrant');
	} catch (error) {
		logger.error({ error: String(error), applicationId }, 'Error updating application status in Qdrant');
	}
}

/**
 * Delete resume vector from Qdrant
 */
export async function deleteResumeVector(organizationId: string, applicationId: string): Promise<void> {
	const collectionName = getCollectionName(organizationId);

	try {
		await qdrantClient.delete(collectionName, {
			wait: true,
			points: [applicationId],
		});
		logger.info({ applicationId }, 'Deleted resume vector from Qdrant');
	} catch (error) {
		logger.error({ error: String(error), applicationId }, 'Error deleting resume vector');
		// Don't throw - deletion failure shouldn't block
	}
}

/**
 * Bulk delete vectors by position ID
 */
export async function bulkDeleteByPosition(organizationId: string, positionId: string): Promise<number> {
	const collectionName = getCollectionName(organizationId);

	try {
		// Check if collection exists
		const collections = await qdrantClient.getCollections();
		const exists = collections.collections.some((c) => c.name === collectionName);

		if (!exists) {
			return 0;
		}

		// Delete by filter
		const result = await qdrantClient.delete(collectionName, {
			wait: true,
			filter: {
				must: [
					{
						key: 'position_id',
						match: { value: positionId },
					},
				],
			},
		});

		logger.info({ positionId }, 'Bulk deleted vectors for position');
		return typeof result === 'object' ? 1 : 0; // Qdrant doesn't return count
	} catch (error) {
		logger.error({ error: String(error), positionId }, 'Error bulk deleting vectors');
		return 0;
	}
}

/**
 * Bulk delete vectors by status (e.g., cleanup rejected applications)
 */
export async function bulkDeleteByStatus(organizationId: string, status: string): Promise<number> {
	const collectionName = getCollectionName(organizationId);

	try {
		// Check if collection exists
		const collections = await qdrantClient.getCollections();
		const exists = collections.collections.some((c) => c.name === collectionName);

		if (!exists) {
			return 0;
		}

		// Delete by filter
		await qdrantClient.delete(collectionName, {
			wait: true,
			filter: {
				must: [
					{
						key: 'status',
						match: { value: status },
					},
				],
			},
		});

		logger.info({ status }, 'Bulk deleted vectors by status');
		return 1;
	} catch (error) {
		logger.error({ error: String(error), status }, 'Error bulk deleting vectors by status');
		return 0;
	}
}

/**
 * Bulk delete multiple application vectors
 */
export async function bulkDeleteApplications(organizationId: string, applicationIds: string[]): Promise<number> {
	const collectionName = getCollectionName(organizationId);

	try {
		if (applicationIds.length === 0) return 0;

		await qdrantClient.delete(collectionName, {
			wait: true,
			points: applicationIds,
		});

		logger.info({ count: applicationIds.length }, 'Bulk deleted application vectors');
		return applicationIds.length;
	} catch (error) {
		logger.error({ error: String(error) }, 'Error bulk deleting vectors');
		return 0;
	}
}

interface SearchResult {
	applicationId: string;
	candidateName: string;
	candidateEmail: string;
	resumePreview: string;
	positionId: string;
	score: number;
	createdAt: string;
	status: string;
	overallScore: number | null;
	matchedSkills: string[];
	unmatchedSkills: string[];
	bonusSkills: string[];
	experienceScore: number | null;
	projectsScore: number | null;
}

interface SearchOptions {
	positionId?: string;
	status?: string | string[];
	excludeStatus?: string | string[];
	minScore?: number;
	limit?: number;
}

/**
 * Search resumes using semantic similarity
 */
export async function searchResumes(
	query: string,
	organizationId: string,
	options: SearchOptions = {}
): Promise<SearchResult[]> {
	const collectionName = getCollectionName(organizationId);
	const { positionId, status, excludeStatus, minScore, limit = 10 } = options;

	try {
		// Check if collection exists
		const collections = await qdrantClient.getCollections();
		const exists = collections.collections.some((c) => c.name === collectionName);

		if (!exists) {
			console.log(`Collection ${collectionName} does not exist, returning empty results`);
			return [];
		}

		// Generate query embedding
		const queryEmbedding = await generateEmbedding(query);

		if (queryEmbedding.length === 0) {
			logger.warn('Empty query embedding, returning empty results');
			return [];
		}

		// Build filter conditions
		const mustConditions: any[] = [];
		const mustNotConditions: any[] = [];

		// Filter by position
		if (positionId) {
			mustConditions.push({
				key: 'position_id',
				match: { value: positionId },
			});
		}

		// Filter by status (include)
		if (status) {
			if (Array.isArray(status)) {
				mustConditions.push({
					key: 'status',
					match: { any: status },
				});
			} else {
				mustConditions.push({
					key: 'status',
					match: { value: status },
				});
			}
		}

		// Filter by status (exclude)
		if (excludeStatus) {
			if (Array.isArray(excludeStatus)) {
				for (const s of excludeStatus) {
					mustNotConditions.push({
						key: 'status',
						match: { value: s },
					});
				}
			} else {
				mustNotConditions.push({
					key: 'status',
					match: { value: excludeStatus },
				});
			}
		}

		// Filter by minimum ATS score
		if (minScore !== undefined) {
			mustConditions.push({
				key: 'overall_score',
				range: { gte: minScore },
			});
		}

		// Build filter object
		const filter: any = {};
		if (mustConditions.length > 0) {
			filter.must = mustConditions;
		}
		if (mustNotConditions.length > 0) {
			filter.must_not = mustNotConditions;
		}

		// Search in Qdrant
		const searchResult = await qdrantClient.search(collectionName, {
			vector: queryEmbedding,
			limit,
			filter: Object.keys(filter).length > 0 ? filter : undefined,
			with_payload: true,
		});

		// Map results
		return searchResult.map((result) => ({
			applicationId: result.payload?.application_id as string,
			candidateName: result.payload?.candidate_name as string,
			candidateEmail: result.payload?.candidate_email as string,
			resumePreview: result.payload?.resume_preview as string,
			positionId: result.payload?.position_id as string,
			score: result.score,
			createdAt: result.payload?.created_at as string,
			status: (result.payload?.status as string) || 'pending',
			overallScore: (result.payload?.overall_score as number) ?? null,
			matchedSkills: (result.payload?.matched_skills as string[]) || [],
			unmatchedSkills: (result.payload?.unmatched_skills as string[]) || [],
			bonusSkills: (result.payload?.bonus_skills as string[]) || [],
			experienceScore: (result.payload?.experience_score as number) ?? null,
			projectsScore: (result.payload?.projects_score as number) ?? null,
		}));
	} catch (error) {
		logger.error({ error: String(error), collectionName }, 'Error searching resumes');
		return [];
	}
}
