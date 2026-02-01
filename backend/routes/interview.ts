import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
	getInterviewsByOrg,
	getInterviewById,
	createInterview,
	updateInterview,
	deleteInterview,
	getPublicInterviewById,
	verifyInterviewAccess,
	resendInvitation,
} from '../services/interview.service';
import { createAccessToken } from '../services/livekit.service';
import { verifyToken } from '../middleware/auth';

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

// Public Route: Get LiveKit token securely
interviews.get('/public/:id/token', async (c) => {
	const id = c.req.param('id');

	// Candidate params
	const email = c.req.query('email');
	const userKey = c.req.query('userKey');

	// Interviewer auth
	let userId: string | undefined;
	const authHeader = c.req.header('Authorization');
	if (authHeader) {
		try {
			const token = authHeader.replace('Bearer ', '');
			// Use our existing middleware logic or helper to verify
			const payload = await verifyToken(token);
			if (payload && payload.sub) {
				userId = payload.sub;
			}
		} catch (e) {
			// Invalid token, ignore and proceed as guest/candidate attempt
			console.log('Token verification failed in public route', e);
		}
	}

	try {
		const participant = await verifyInterviewAccess(id, email || '', userKey, userId);

		if (!participant) {
			return c.json({ error: 'Unauthorized: Invalid credentials or access key' }, 403);
		}

		// Use the interview ID as the room name
		const token = await createAccessToken(id, participant.identity, participant.name, {
			interviewId: id,
			role: participant.role,
		});

		return c.json({ token, participant });
	} catch (err: any) {
		console.error(`Error generating token for interview ${id}:`, err);
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
 * Resend invitation/reminder for an interview
 */
interviews.post('/:id/invite', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		await resendInvitation(user.id, id);
		return c.json({ message: 'Invitation resent successfully' });
	} catch (err: any) {
		console.error(`Error resending invitation for interview ${id}:`, err);
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
