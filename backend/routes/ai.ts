import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import { generateJobDescription } from '../services/ai.service';

const ai = new Hono<AuthEnv>();

// AI routes require authentication
ai.use('/*', authMiddleware);

/**
 * Generate a job description based on role details
 */
ai.post('/generate-description', async (c) => {
	try {
		const body = await c.req.json();
		const { title, requirements, prompt } = body;

		if (!title) {
			return c.json({ error: 'Job title is required' }, 400);
		}

		const description = await generateJobDescription({
			title,
			requirements: requirements || { skills: [], evaluation_weights: {} },
			prompt,
		});

		return c.json({ description });
	} catch (err: any) {
		console.error('Error generating AI description:', err);
		return c.json({ error: err.message }, 500);
	}
});

export default ai;
