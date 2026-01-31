import { Hono } from 'hono';
import { createUser } from '../services/user.service';
import { authMiddleware, type AuthEnv } from '../middleware/auth';

const user = new Hono<AuthEnv>();

user.use('/*', authMiddleware);

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

export default user;
