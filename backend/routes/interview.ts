import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
	getInterviewsByOrg,
	getInterviewById,
	createInterview,
	updateInterview,
	deleteInterview,
	getPublicInterviewById,
} from '../services/interview.service';

const interviews = new Hono<AuthEnv>();

// Public Route: Get basic interview details (candidate view)
// Must be defined BEFORE the generic /:id route
interviews.get('/public/:id', async (c) => {
	const id = c.req.param('id');
	try {
		const result = await getPublicInterviewById(id);
		if (!result) {
			return c.json({ error: 'Interview not found' }, 404);
		}
		return c.json(result);
	} catch (err: any) {
		console.error(`Error fetching public interview ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

// Auth Middleware for all other routes
interviews.use('/*', async (c, next) => {
	// Skip auth for public route (redundant check if route matched above, but safe)
	if (c.req.path.includes('/public/')) {
		await next();
		return;
	}
	await authMiddleware(c, next);
});

/**
 * Get all interviews for the user's organization
 */
interviews.get('/', async (c) => {
	const user = c.get('user');
	try {
		const result = await getInterviewsByOrg(user.id);
		return c.json(result);
	} catch (err: any) {
		console.error('Error fetching interviews:', err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * Get a specific interview by ID
 */
interviews.get('/:id', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await getInterviewById(user.id, id);
		if (!result) {
			return c.json({ error: 'Interview not found' }, 404);
		}
		return c.json(result);
	} catch (err: any) {
		console.error(`Error fetching interview ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * Create a new interview
 */
interviews.post('/', async (c) => {
	const user = c.get('user');
	try {
		const body = await c.req.json();
		const result = await createInterview(user.id, body);
		return c.json(result, 201);
	} catch (err: any) {
		console.error('Error creating interview:', err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

/**
 * Update an existing interview
 */
interviews.put('/:id', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const body = await c.req.json();
		const result = await updateInterview(user.id, id, body);
		if (!result) {
			return c.json({ error: 'Interview not found' }, 404);
		}
		return c.json(result);
	} catch (err: any) {
		console.error(`Error updating interview ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

/**
 * Delete an interview
 */
interviews.delete('/:id', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await deleteInterview(user.id, id);
		return c.json({ message: 'Interview deleted successfully', id: (result as any).id });
	} catch (err: any) {
		console.error(`Error deleting interview ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

export default interviews;
