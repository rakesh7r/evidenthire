import { Hono } from 'hono';
import { sql } from '../db';
import { analyzeResume } from '../services/ai.service';
import { uploadResumeToS3, deleteResumeFromS3 } from '../services/resume.service';
import {
	upsertResumeVector,
	searchResumes,
	updateApplicationStatus,
	deleteResumeVector,
	bulkDeleteByPosition,
	bulkDeleteByStatus,
	bulkDeleteApplications,
} from '../services/qdrant.service';
import { notifyApplicationRejected } from '../services/email.service';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import logger from '../lib/logger';

const app = new Hono<AuthEnv>();

/**
 * GET /applications/search
 * Search applications using semantic similarity (requires auth)
 */
app.get('/search', authMiddleware, async (c) => {
	const user = c.get('user');
	const query = c.req.query('q');
	const positionId = c.req.query('positionId');
	const status = c.req.query('status'); // single status or comma-separated
	const excludeStatus = c.req.query('excludeStatus'); // e.g., "rejected"
	const minScoreStr = c.req.query('minScore');
	const limitStr = c.req.query('limit');

	const limit = limitStr ? parseInt(limitStr, 10) : 10;
	const minScore = minScoreStr ? parseInt(minScoreStr, 10) : undefined;

	if (!query) {
		return c.json({ error: 'Search query is required' }, 400);
	}

	try {
		// Get user's organization
		const userOrg = await sql`
            SELECT organization_id FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;

		// If positionId provided, verify it belongs to org
		if (positionId) {
			const positionCheck = await sql`
                SELECT id FROM position 
                WHERE id = ${positionId} AND organization_id = ${orgId}
            `;

			if (!positionCheck || positionCheck.length === 0) {
				return c.json({ error: 'Position not found or not accessible' }, 404);
			}
		}

		// Parse status filters
		const statusArray = status ? status.split(',').map((s) => s.trim()) : undefined;
		const excludeStatusArray = excludeStatus ? excludeStatus.split(',').map((s) => s.trim()) : undefined;

		// Perform semantic search with filters
		const searchResults = await searchResumes(query, orgId, {
			positionId,
			status: statusArray,
			excludeStatus: excludeStatusArray,
			minScore,
			limit,
		});

		// Enrich results with full application data from DB
		const applicationIds = searchResults.map((r) => r.applicationId);

		if (applicationIds.length === 0) {
			return c.json({ results: [], total: 0, query });
		}

		const applications = await sql`
            SELECT 
                a.id,
                a.email,
                a.name,
                a.resume_s3_url,
                a.cv_analysis,
                a.status,
                a.created_at,
                a.position_id,
                p.title as position_title
            FROM application a
            JOIN position p ON a.position_id = p.id
            WHERE a.id = ANY(${applicationIds})
        `;

		// Merge search scores with application data
		const results = searchResults.map((sr) => {
			const app = applications.find((a: any) => a.id === sr.applicationId);
			return {
				...app,
				similarity_score: sr.score,
				resume_preview: sr.resumePreview,
				matched_skills: sr.matchedSkills,
				unmatched_skills: sr.unmatchedSkills,
				overall_score: sr.overallScore,
				bonus_skills: sr.bonusSkills,
				experience_score: sr.experienceScore,
				projects_score: sr.projectsScore,
			};
		});

		return c.json({
			results,
			total: results.length,
			query,
		});
	} catch (error: any) {
		logger.error({ error: error.message || String(error) }, 'Error searching applications');
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

/**
 * PUT /applications/:id/status
 * Update application status (requires auth)
 */
app.put('/:id/status', authMiddleware, async (c) => {
	const user = c.get('user');
	const applicationId = c.req.param('id');

	try {
		const body = await c.req.json();
		const { status } = body;

		if (!status) {
			return c.json({ error: 'Status is required' }, 400);
		}

		const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];
		if (!validStatuses.includes(status)) {
			return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
		}

		// Get user's organization
		const userOrg = await sql`
            SELECT organization_id FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;

		// Verify application belongs to user's organization
		const appCheck = await sql`
            SELECT a.id, a.position_id, a.resume_s3_url, a.name, a.email, p.title as position_title, o.name as org_name
            FROM application a
            JOIN position p ON a.position_id = p.id
            JOIN organization o ON p.organization_id = o.id
            WHERE a.id = ${applicationId} AND p.organization_id = ${orgId}
        `;

		if (!appCheck || appCheck.length === 0) {
			return c.json({ error: 'Application not found or not accessible' }, 404);
		}

		const app = appCheck[0]!;

		if (status === 'rejected') {
			// Special handling for rejected applications:
			// 1. Remove from Qdrant
			// 2. Remove from S3
			// 3. Update DB status and clear S3 URL

			// Delete from S3 (non-blocking)
			if (app.resume_s3_url) {
				deleteResumeFromS3(app.resume_s3_url).catch((err) => {
					logger.error({ error: String(err), applicationId }, 'Failed to delete resume from S3');
				});
			}

			// Delete from Qdrant (non-blocking)
			deleteResumeVector(orgId, applicationId).catch((err) => {
				logger.error({ error: String(err), applicationId }, 'Failed to delete from Qdrant');
			});

			// Send regret email (non-blocking)
			if (app.email) {
				notifyApplicationRejected({
					candidateEmail: app.email,
					candidateName: app.name,
					positionTitle: app.position_title,
					organizationName: app.org_name,
				}).catch((err) => {
					logger.error({ error: String(err), applicationId }, 'Failed to send regret email');
				});
			}

			// Update status in database
			await sql`
                UPDATE application 
                SET status = 'rejected', resume_s3_url = NULL, updated_at = NOW()
                WHERE id = ${applicationId}
            `;
		} else {
			// Normal status update
			await sql`
                UPDATE application 
                SET status = ${status}, updated_at = NOW()
                WHERE id = ${applicationId}
            `;

			// Update status in Qdrant (non-blocking)
			updateApplicationStatus(orgId, applicationId, status).catch((err) => {
				logger.error({ error: String(err), applicationId }, 'Failed to update Qdrant status');
			});
		}

		return c.json({ success: true, applicationId, status });
	} catch (error: any) {
		logger.error({ error: error.message || String(error), applicationId }, 'Error updating application status');
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

/**
 * DELETE /applications/:id
 * Delete an application (requires auth)
 */
app.delete('/:id', authMiddleware, async (c) => {
	const user = c.get('user');
	const applicationId = c.req.param('id');

	try {
		// Get user's organization
		const userOrg = await sql`
            SELECT organization_id FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;

		// Fetch application with S3 URL before deletion
		const appData = await sql`
            SELECT a.id, a.resume_s3_url, a.position_id, p.organization_id
            FROM application a
            JOIN position p ON a.position_id = p.id
            WHERE a.id = ${applicationId} AND p.organization_id = ${orgId}
        `;

		if (!appData || appData.length === 0) {
			return c.json({ error: 'Application not found or not accessible' }, 404);
		}

		const app = appData[0]!;

		// Delete from database
		await sql`DELETE FROM application WHERE id = ${applicationId}`;

		// Delete from S3 (non-blocking)
		if (app.resume_s3_url) {
			deleteResumeFromS3(app.resume_s3_url).catch((err) => {
				logger.error({ error: String(err), applicationId }, 'Failed to delete resume from S3');
			});
		}

		// Delete from Qdrant (non-blocking)
		deleteResumeVector(orgId, applicationId).catch((err) => {
			logger.error({ error: String(err), applicationId }, 'Failed to delete from Qdrant');
		});

		return c.json({ success: true, applicationId });
	} catch (error: any) {
		logger.error({ error: error.message || String(error), applicationId }, 'Error deleting application');
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

/**
 * POST /applications/bulk-delete
 * Bulk delete applications (requires auth)
 */
app.post('/bulk-delete', authMiddleware, async (c) => {
	const user = c.get('user');

	try {
		const body = await c.req.json();
		const { applicationIds, positionId, status } = body;

		// Get user's organization
		const userOrg = await sql`
            SELECT organization_id, role FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;
		const role = userOrg[0]!.role;

		// Only admins can bulk delete
		if (role !== 'admin') {
			return c.json({ error: 'Only admins can perform bulk delete' }, 403);
		}

		let deletedCount = 0;

		if (applicationIds && Array.isArray(applicationIds) && applicationIds.length > 0) {
			// Delete specific applications
			// First fetch their S3 URLs and verify org access
			const apps = await sql`
                SELECT a.id, a.resume_s3_url
                FROM application a
                JOIN position p ON a.position_id = p.id
                WHERE a.id = ANY(${applicationIds}) AND p.organization_id = ${orgId}
            `;

			const validIds = apps.map((a: any) => a.id);

			if (validIds.length > 0) {
				// Delete from database
				await sql`DELETE FROM application WHERE id = ANY(${validIds})`;

				// Delete from S3 (non-blocking)
				for (const app of apps) {
					if (app.resume_s3_url) {
						deleteResumeFromS3(app.resume_s3_url).catch(console.error);
					}
				}

				// Delete from Qdrant (non-blocking)
				bulkDeleteApplications(orgId, validIds).catch(console.error);

				deletedCount = validIds.length;
			}
		} else if (positionId) {
			// Delete all applications for a position
			const posCheck = await sql`
                SELECT id FROM position WHERE id = ${positionId} AND organization_id = ${orgId}
            `;

			if (posCheck && posCheck.length > 0) {
				// Fetch apps for S3 cleanup
				const apps = await sql`
                    SELECT id, resume_s3_url FROM application WHERE position_id = ${positionId}
                `;

				// Delete from database
				const result = await sql`DELETE FROM application WHERE position_id = ${positionId}`;
				deletedCount = result.count || apps.length;

				// Delete from S3
				for (const app of apps) {
					if (app.resume_s3_url) {
						deleteResumeFromS3(app.resume_s3_url).catch(console.error);
					}
				}

				// Delete from Qdrant
				bulkDeleteByPosition(orgId, positionId).catch(console.error);
			}
		} else if (status) {
			// Delete all applications with a specific status
			// Fetch apps first
			const apps = await sql`
                SELECT a.id, a.resume_s3_url
                FROM application a
                JOIN position p ON a.position_id = p.id
                WHERE a.status = ${status} AND p.organization_id = ${orgId}
            `;

			const ids = apps.map((a: any) => a.id);

			if (ids.length > 0) {
				// Delete from database
				await sql`DELETE FROM application WHERE id = ANY(${ids})`;

				// Delete from S3
				for (const app of apps) {
					if (app.resume_s3_url) {
						deleteResumeFromS3(app.resume_s3_url).catch(console.error);
					}
				}

				// Delete from Qdrant
				bulkDeleteByStatus(orgId, status).catch(console.error);

				deletedCount = ids.length;
			}
		} else {
			return c.json({ error: 'Provide applicationIds, positionId, or status' }, 400);
		}

		return c.json({ success: true, deletedCount });
	} catch (error: any) {
		logger.error({ error: error.message || String(error) }, 'Error bulk deleting applications');
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

/**
 * GET /applications/position/:positionId
 * Fetch all applications for a specific position (requires auth)
 */
app.get('/position/:positionId', authMiddleware, async (c) => {
	const positionId = c.req.param('positionId');
	const user = c.get('user');

	try {
		// Verify user has access to this position (belongs to same organization)
		const userOrg = await sql`
            SELECT organization_id FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;

		// Verify position belongs to user's organization
		const positionCheck = await sql`
            SELECT id FROM position 
            WHERE id = ${positionId} AND organization_id = ${orgId}
        `;

		if (!positionCheck || positionCheck.length === 0) {
			return c.json({ error: 'Position not found or not accessible' }, 404);
		}

		// Fetch all applications for this position
		const applications = await sql`
            SELECT 
                id,
                email,
                name,
                resume_s3_url,
                cv_analysis,
                status,
                created_at,
                updated_at
            FROM application
            WHERE position_id = ${positionId} AND status != 'rejected'
            ORDER BY created_at DESC
        `;

		return c.json({
			applications,
			total: applications.length,
		});
	} catch (error: any) {
		logger.error({ error: error.message || String(error), positionId }, 'Error fetching applications');
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

/**
 * POST /applications/apply
 * Submit a new job application (public - no auth required)
 */
app.post('/apply', async (c) => {
	try {
		const body = await c.req.parseBody();
		const name = body['name'] as string;
		const email = body['email'] as string;
		const positionId = body['positionId'] as string;
		const resumeFile = body['resume'] as File;

		if (!name || !email || !positionId || !resumeFile) {
			return c.json({ error: 'Missing required fields' }, 400);
		}

		// Normalize email for consistent lookups
		const normalizedEmail = email.toLowerCase().trim();

		// 1. Fetch Position, Job Description, and Organization ID
		const positions = await sql`
            SELECT id, title, job_description, organization_id 
            FROM position 
            WHERE id = ${positionId}
        `;

		if (!positions || positions.length === 0) {
			return c.json({ error: 'Position not found' }, 404);
		}

		const position = positions[0]!;
		const jobDescriptionText = position.job_description || '';
		const organizationId = position.organization_id;

		if (!jobDescriptionText) {
			logger.warn({ positionId }, 'No job description found for position');
		}

		// 2. Parse Resume (PDF)
		let resumeText = '';
		try {
			const arrayBuffer = await resumeFile.arrayBuffer();
			const typedArray = new Uint8Array(arrayBuffer);

			// Load the PDF document
			const loadingTask = pdfjsLib.getDocument({ data: typedArray });
			const pdfDocument = await loadingTask.promise;

			// Extract text from all pages
			const numPages = pdfDocument.numPages;
			const textParts: string[] = [];

			for (let i = 1; i <= numPages; i++) {
				const page = await pdfDocument.getPage(i);
				const textContent = await page.getTextContent();
				const pageText = textContent.items.map((item: any) => item.str).join(' ');
				textParts.push(pageText);
			}

			resumeText = textParts.join('\n');
		} catch (e) {
			logger.error({ error: String(e) }, 'Error parsing PDF');
			return c.json({ error: 'Failed to parse resume PDF' }, 400);
		}

		// 3. Check for existing application for this email + position
		const existingApplications = await sql`
            SELECT id, resume_s3_url 
            FROM application 
            WHERE email = ${normalizedEmail} AND position_id = ${positionId}
        `;

		const existingApplication =
			existingApplications && existingApplications.length > 0 ? existingApplications[0] : null;

		// 4. Upload resume to S3
		const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());
		const resumeS3Url = await uploadResumeToS3(
			resumeBuffer,
			resumeFile.name,
			resumeFile.type,
			positionId,
			normalizedEmail
		);

		// 5. If existing application, delete old resume from S3
		if (existingApplication && existingApplication.resume_s3_url) {
			logger.info({ email: normalizedEmail, positionId }, 'Deleting old resume for re-application');
			await deleteResumeFromS3(existingApplication.resume_s3_url);
		}

		// 6. Analyze Resume with AI
		let analysisResult: any = null;
		logger.info(
			{ jdLength: jobDescriptionText.length, resumeLength: resumeText.length },
			'Resumes metadata for AI analysis'
		);

		if (jobDescriptionText && resumeText) {
			try {
				logger.info('Starting AI resume analysis');
				analysisResult = await analyzeResume(resumeText, jobDescriptionText);
				logger.info({ analysis: analysisResult }, 'AI Analysis completed');
			} catch (e) {
				logger.error({ error: String(e) }, 'AI Analysis failed');
			}
		} else {
			logger.warn('Skipping AI analysis - missing job description or resume text');
		}

		// 7. Upsert Application Record
		let applicationId: string;
		const now = new Date().toISOString();
		const initialStatus = 'pending';

		if (existingApplication) {
			// Update existing application
			const updateResult = await sql`
                UPDATE application 
                SET 
                    name = ${name},
                    resume_s3_url = ${resumeS3Url},
                    cv_analysis = ${analysisResult ? sql.json(analysisResult) : null},
                    status = ${initialStatus},
                    updated_at = NOW()
                WHERE id = ${existingApplication.id}
                RETURNING id
            `;
			applicationId = updateResult[0]?.id;
			logger.info({ applicationId, email: normalizedEmail, positionId }, 'Updated application');
		} else {
			// Create new application
			const insertResult = await sql`
                INSERT INTO application (position_id, email, name, resume_s3_url, cv_analysis, status)
                VALUES (${positionId}, ${normalizedEmail}, ${name}, ${resumeS3Url}, ${
				analysisResult ? sql.json(analysisResult) : null
			}, ${initialStatus})
                RETURNING id
            `;
			applicationId = insertResult[0]?.id;
			logger.info({ applicationId, email: normalizedEmail, positionId }, 'Created new application');
		}

		if (!applicationId) {
			throw new Error('Failed to create/update application record');
		}

		// 8. Store resume embedding in Qdrant (non-blocking)
		if (resumeText && organizationId) {
			upsertResumeVector(resumeText, {
				organizationId,
				positionId,
				applicationId,
				candidateName: name,
				candidateEmail: normalizedEmail,
				resumePreview: resumeText.slice(0, 500),
				createdAt: now,
				status: initialStatus,
				overallScore: analysisResult?.overallScore ?? null,
				skillsMatch: analysisResult?.skillsMatch ?? null,
				bonusSkills: analysisResult?.bonusSkills ?? null,
				experienceScore: analysisResult?.experienceScore ?? null,
				projectsScore: analysisResult?.projectsScore ?? null,
			}).catch((err) => {
				logger.error({ error: String(err), applicationId }, 'Failed to store resume vector');
			});
		}

		return c.json({
			success: true,
			applicationId,
			isUpdate: !!existingApplication,
			analysis: analysisResult,
		});
	} catch (error: any) {
		logger.error({ error: error.message || String(error) }, 'Error processing application');
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

export default app;
