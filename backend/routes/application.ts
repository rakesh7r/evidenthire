import { Hono } from 'hono';
import { sql } from '../db';
import { analyzeResume } from '../services/ai.service';
import { uploadResumeToS3, deleteResumeFromS3 } from '../services/resume.service';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const app = new Hono();

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
		if (jobDescriptionText && resumeText) {
			try {
				analysisResult = await analyzeResume(resumeText, jobDescriptionText);
			} catch (e) {
				console.error('AI Analysis failed:', e);
			}
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
