import { Hono } from 'hono';
import { sql } from '../db';
import { analyzeResume } from '../services/ai.service';
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

		// 3. Analyze Resume with AI
		let analysisResult = null;
		if (jobDescriptionText && resumeText) {
			try {
				analysisResult = await analyzeResume(resumeText, jobDescriptionText);
			} catch (e) {
				console.error('AI Analysis failed:', e);
			}
		}

		// 4. Save Candidate
		const result = await sql`
            INSERT INTO candidate (name, email, cv_analysis)
            VALUES (${name}, ${email}, ${analysisResult ? sql.json(analysisResult) : null})
            RETURNING id
        `;

		const candidateId = result && result.length > 0 ? result[0]?.id : null;

		if (!candidateId) {
			throw new Error('Failed to create candidate record');
		}

		return c.json({
			success: true,
			candidateId,
			analysis: analysisResult,
		});
	} catch (error: any) {
		console.error('Error processing application:', error);
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

export default app;
