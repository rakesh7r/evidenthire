import { Hono } from 'hono';
import {
	createUser,
	updateUserOnboarding,
	getUserById,
	updateUserProfile,
	getUsersByOrg,
} from '../services/user.service';
import { authMiddleware, type AuthEnv } from '../middleware/auth';

const user = new Hono<AuthEnv>();

// Public Routes (No Auth Middleware)
// None - all user routes require auth

user.use('/*', authMiddleware);

user.get('/me', async (c) => {
	const supabaseUser = c.get('user');
	if (!supabaseUser || !supabaseUser.email) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	try {
		// First, ensure the user exists and ID is synced (handles invited users with mismatched IDs)
		await createUser({ id: supabaseUser.id, email: supabaseUser.email });

		// Now fetch the full user data
		const user = await getUserById(supabaseUser.id);
		if (!user) {
			return c.json({ error: 'User not found', searchedId: supabaseUser.id }, 404);
		}
		return c.json(user);
	} catch (err: any) {
		console.error('Error fetching user:', err);
		return c.json({ error: 'Internal server error', details: err.message }, 500);
	}
});

user.get('/team', async (c) => {
	const supabaseUser = c.get('user');
	try {
		const result = await getUsersByOrg(supabaseUser.id);
		return c.json(result);
	} catch (err: any) {
		console.error('Error fetching team:', err);
		return c.json({ error: err.message }, 500);
	}
});

user.post('/me', async (c) => {
	const supabaseUser = c.get('user');

	if (!supabaseUser || !supabaseUser.email) {
		return c.json({ error: 'User email required' }, 400);
	}

	try {
		const newUser = await createUser({
			id: supabaseUser.id,
			email: supabaseUser.email,
		});
		return c.json(newUser);
	} catch (err) {
		console.error('Service error:', err);
		return c.json({ error: (err as Error).message }, 500);
	}
});

user.put('/me', async (c) => {
	const supabaseUser = c.get('user');
	if (!supabaseUser) return c.json({ error: 'Unauthorized' }, 401);

	try {
		const body = await c.req.json();
		// Updates profile fields provided in body
		const updatedUser = await updateUserProfile(supabaseUser.id, body);
		return c.json(updatedUser);
	} catch (err: any) {
		console.error('Update failed:', err);
		return c.json({ error: 'Failed to update profile', details: err.message }, 500);
	}
});

user.post('/onboarding', async (c) => {
	const supabaseUser = c.get('user');

	if (!supabaseUser || !supabaseUser.email) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	try {
		const body = await c.req.json();

		// Ensure user exists (upsert) using the authenticated ID
		await createUser({ id: supabaseUser.id, email: supabaseUser.email });

		// Complete onboarding
		const updatedUser = await updateUserOnboarding(supabaseUser.id, body);
		return c.json(updatedUser);
	} catch (err) {
		console.error('Onboarding failed:', err);
		return c.json({ error: 'Failed to complete onboarding' }, 500);
	}
});

export default user;
