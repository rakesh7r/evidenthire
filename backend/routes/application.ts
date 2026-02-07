import { Hono } from 'hono';
import { sql } from '../db';
import { analyzeResume } from '../services/ai.service';
import { uploadResumeToS3, deleteResumeFromS3 } from '../services/resume.service';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const app = new Hono<AuthEnv>();

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
            WHERE position_id = ${positionId}
            ORDER BY created_at DESC
        `;

		return c.json({
			applications,
			total: applications.length,
		});
	} catch (error: any) {
		console.error('Error fetching applications:', error);
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

		// 1. Fetch Position and Job Description
		const positions = await sql`
            SELECT title, job_description 
            FROM position 
            WHERE id = ${positionId}
        `;

		if (!positions || positions.length === 0) {
			return c.json({ error: 'Position not found' }, 404);
		}

		const position = positions[0]!;
		const jobDescriptionText = position.job_description || '';

		if (!jobDescriptionText) {
			console.warn('No job description found for position', positionId);
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
			console.error('Error parsing PDF:', e);
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
			console.log(`Deleting old resume for ${normalizedEmail} applying to position ${positionId}`);
			await deleteResumeFromS3(existingApplication.resume_s3_url);
		}

		// 6. Analyze Resume with AI
		let analysisResult = null;
		console.log(`Job description length: ${jobDescriptionText.length}, Resume text length: ${resumeText.length}`);

		if (jobDescriptionText && resumeText) {
			try {
				console.log('Starting AI resume analysis...');
				analysisResult = await analyzeResume(resumeText, jobDescriptionText);
				console.log('AI Analysis completed:', JSON.stringify(analysisResult, null, 2));
			} catch (e) {
				console.error('AI Analysis failed:', e);
			}
		} else {
			console.warn('Skipping AI analysis - missing job description or resume text');
		}

		// 7. Upsert Application Record
		let applicationId: string;

		if (existingApplication) {
			// Update existing application
			const updateResult = await sql`
                UPDATE application 
                SET 
                    name = ${name},
                    resume_s3_url = ${resumeS3Url},
                    cv_analysis = ${analysisResult ? sql.json(analysisResult) : null},
                    status = 'pending',
                    updated_at = NOW()
                WHERE id = ${existingApplication.id}
                RETURNING id
            `;
			applicationId = updateResult[0]?.id;
			console.log(`Updated application ${applicationId} for ${normalizedEmail} to position ${positionId}`);
		} else {
			// Create new application
			const insertResult = await sql`
                INSERT INTO application (position_id, email, name, resume_s3_url, cv_analysis)
                VALUES (${positionId}, ${normalizedEmail}, ${name}, ${resumeS3Url}, ${
				analysisResult ? sql.json(analysisResult) : null
			})
                RETURNING id
            `;
			applicationId = insertResult[0]?.id;
			console.log(`Created new application ${applicationId} for ${normalizedEmail} to position ${positionId}`);
		}

		if (!applicationId) {
			throw new Error('Failed to create/update application record');
		}

		return c.json({
			success: true,
			applicationId,
			isUpdate: !!existingApplication,
			analysis: analysisResult,
		});
	} catch (error: any) {
		console.error('Error processing application:', error);
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

export default app;
