import { createMiddleware } from 'hono/factory';
import { createClient, type User } from '@supabase/supabase-js';

export type AuthEnv = {
	Variables: {
		user: User;
	};
};

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export const verifyToken = async (token: string) => {
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);

	if (error) throw error;
	if (!user) throw new Error('User not found');

	// For JWT compatibility return shape
	return { sub: user.id, ...user };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
	const authHeader = c.req.header('Authorization');
	if (!authHeader) {
		return c.json({ error: 'Missing Authorization header' }, 401);
	}

	const token = authHeader.replace('Bearer ', '');

	try {
		const user = await verifyToken(token);
		// Cast back to supabase User type roughly if needed or construct it
		// Since verifyToken calls getUser, let's just use the returned user object roughly
		// Ideally we should return the exact user object from verifyToken
		// But for minimal diff:

		const {
			data: { user: supabaseUser },
		} = await supabase.auth.getUser(token); // Redundant but safe refactor
		if (supabaseUser) {
			c.set('user', supabaseUser);
		} else {
			throw new Error('User not found');
		}
	} catch (e) {
		console.error('Auth error:', e);
		return c.json({ error: 'Unauthorized' }, 401);
	}
	await next();
});
