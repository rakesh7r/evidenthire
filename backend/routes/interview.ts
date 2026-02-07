import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import logger from '../lib/logger';
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
import {
	checkInterviewAccess,
	recordParticipantJoin,
	admitCandidate,
	getCandidateWaitingStatus,
	endInterview,
	getInterviewStatusSummary,
	ACCESS_CONFIG,
} from '../services/interview-access.service';

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

		// Get status summary for timing info
		const statusSummary = await getInterviewStatusSummary(id);

		// Remove sensitive access key from public response
		const { candidate_access_key, ...safeResult } = result as any;
		return c.json({
			...safeResult,
			accessConfig: {
				earlyJoinMinutes: ACCESS_CONFIG.EARLY_JOIN_WINDOW_MINUTES,
				lateGraceMinutes: ACCESS_CONFIG.LATE_JOIN_GRACE_MINUTES,
			},
			statusSummary,
		});
	} catch (err: any) {
		logger.error({ error: String(err), interviewId: id }, 'Error fetching public interview');
		return c.json({ error: err.message }, 500);
	}
});

// Public Route: Validate candidate credentials
interviews.get('/public/:id/validate', async (c) => {
	const id = c.req.param('id');
	const email = c.req.query('email');
	const candidateAccessKey = c.req.query('candidate_access_key');

	if (!email || !candidateAccessKey) {
		return c.json({ valid: false, error: 'Missing credentials' }, 400);
	}

	try {
		const participant = await verifyInterviewAccess(id, email, candidateAccessKey);
		if (participant && participant.role === 'candidate') {
			return c.json({ valid: true });
		}
		return c.json({ valid: false, error: 'Invalid credentials' }, 403);
	} catch (err: any) {
		console.error(`Error validating interview access ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

// Public Route: Check interview access status (used by client to show appropriate UI)
interviews.get('/public/:id/access-status', async (c) => {
	const id = c.req.param('id');
	const role = (c.req.query('role') as 'candidate' | 'interviewer') || 'candidate';

	try {
		const accessResult = await checkInterviewAccess(id, role);
		return c.json(accessResult);
	} catch (err: any) {
		console.error(`Error checking access status for interview ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

// Public Route: Get candidate waiting room status
interviews.get('/public/:id/waiting-status', async (c) => {
	const id = c.req.param('id');
	try {
		const status = await getCandidateWaitingStatus(id);
		return c.json(status);
	} catch (err: any) {
		console.error(`Error getting waiting status for interview ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

// Public Route: Get LiveKit token securely
interviews.get('/public/:id/token', async (c) => {
	const id = c.req.param('id');

	// Candidate params
	const email = c.req.query('email');
	const candidateAccessKey = c.req.query('candidate_access_key');

	// Interviewer auth
	let userId: string | undefined;
	const authHeader = c.req.header('Authorization');
	if (authHeader) {
		try {
			const token = authHeader.replace('Bearer ', '');
			const payload = await verifyToken(token);
			if (payload && payload.sub) {
				userId = payload.sub;
			}
		} catch (e) {
			console.log('Token verification failed in public route', e);
		}
	}

	try {
		const participant = await verifyInterviewAccess(id, email || '', candidateAccessKey, userId);

		if (!participant) {
			return c.json({ error: 'Unauthorized: Invalid credentials or access key' }, 403);
		}

		// Check time-based access
		const participantRole = participant.role as 'candidate' | 'interviewer' | 'observer';
		const accessResult = await checkInterviewAccess(id, participantRole);

		if (!accessResult.allowed && !accessResult.waitingRoom) {
			return c.json(
				{
					error: accessResult.reason,
					code: accessResult.code,
					scheduledStart: accessResult.scheduledStart,
					joinWindowStart: accessResult.joinWindowStart,
				},
				403
			);
		}

		// If candidate is in waiting room, return waiting room response instead of token
		if (accessResult.waitingRoom && participant.role === 'candidate') {
			return c.json(
				{
					waitingRoom: true,
					message: accessResult.message,
					scheduledStart: accessResult.scheduledStart,
				},
				200
			);
		}

		// Record the join
		await recordParticipantJoin(id, participantRole);

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

/**
 * Admit a candidate from the waiting room (interviewer only)
 */
interviews.post('/:id/admit', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await admitCandidate(id, user.id);
		if (!result.success) {
			return c.json({ error: result.message }, 403);
		}
		return c.json({ message: result.message });
	} catch (err: any) {
		console.error(`Error admitting candidate for interview ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * End an interview (interviewer only)
 */
interviews.post('/:id/end', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await endInterview(id, 'interviewer_ended', user.id);
		if (!result.success) {
			return c.json({ error: result.message }, 403);
		}
		return c.json({ message: result.message, status: result.status });
	} catch (err: any) {
		console.error(`Error ending interview ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

export default interviews;
