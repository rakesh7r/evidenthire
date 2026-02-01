import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
	getPositionsByOrg,
	getPositionById,
	createPosition,
	updatePosition,
	deletePosition,
	getPositionStats,
	getDashboardStats,
} from '../services/position.service';

const positions = new Hono<AuthEnv>();

// All position routes require authentication
positions.use('/*', authMiddleware);

/**
 * Get aggregated dashboard statistics
 */
positions.get('/dashboard/stats', async (c) => {
	const user = c.get('user');
	try {
		const result = await getDashboardStats(user.id);
		return c.json(result);
	} catch (err: any) {
		console.error('Error fetching dashboard stats:', err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * Get position statistics
 */
positions.get('/stats', async (c) => {
	const user = c.get('user');
	try {
		const result = await getPositionStats(user.id);
		return c.json(result);
	} catch (err: any) {
		console.error('Error fetching position stats:', err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * Get all positions for the user's organization
 */
positions.get('/', async (c) => {
	const user = c.get('user');
	try {
		const result = await getPositionsByOrg(user.id);
		return c.json(result);
	} catch (err: any) {
		console.error('Error fetching positions:', err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * Get a specific position by ID
 */
positions.get('/:id', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await getPositionById(user.id, id);
		if (!result) {
			return c.json({ error: 'Position not found' }, 404);
		}
		return c.json(result);
	} catch (err: any) {
		console.error(`Error fetching position ${id}:`, err);
		return c.json({ error: err.message }, 500);
	}
});

/**
 * Create a new position
 * Only admins and recruiters authorized
 */
positions.post('/', async (c) => {
	const user = c.get('user');
	try {
		const body = await c.req.json();
		const result = await createPosition(user.id, body);
		return c.json(result, 201);
	} catch (err: any) {
		console.error('Error creating position:', err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

/**
 * Update an existing position
 * Only admins and recruiters authorized
 */
positions.put('/:id', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const body = await c.req.json();
		const result = await updatePosition(user.id, id, body);
		if (!result) {
			return c.json({ error: 'Position not found' }, 404);
		}
		return c.json(result);
	} catch (err: any) {
		console.error(`Error updating position ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

/**
 * Delete a position
 * Only admins and recruiters authorized
 */
positions.delete('/:id', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await deletePosition(user.id, id);
		return c.json({ message: 'Position deleted successfully', id: result.id });
	} catch (err: any) {
		console.error(`Error deleting position ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

// Import pipeline service functions
import { getPipeline, updatePipelineStages, moveCandidate } from '../services/pipeline.service';

/**
 * Get pipeline stages and candidates for a position
 */
positions.get('/:id/pipeline', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		const result = await getPipeline(user.id, id);
		return c.json(result);
	} catch (err: any) {
		console.error(`Error fetching pipeline for position ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

/**
 * Update pipeline stages for a position
 */
positions.put('/:id/pipeline', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		// body: { stages: [{ id?, name }] }
		const body = await c.req.json();
		const result = await updatePipelineStages(user.id, id, body.stages);
		return c.json(result);
	} catch (err: any) {
		console.error(`Error updating pipeline for position ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

/**
 * Move a candidate to a specific stage
 */
positions.post('/:id/move', async (c) => {
	const user = c.get('user');
	const id = c.req.param('id');
	try {
		// body: { candidateId, stageId }
		const body = await c.req.json();
		const result = await moveCandidate(user.id, id, body.candidateId, body.stageId);
		return c.json(result);
	} catch (err: any) {
		console.error(`Error moving candidate in position ${id}:`, err);
		const status = err.message.includes('Unauthorized') ? 403 : 500;
		return c.json({ error: err.message }, status);
	}
});

export default positions;
