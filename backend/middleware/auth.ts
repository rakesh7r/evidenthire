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

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
	const authHeader = c.req.header('Authorization');
	if (!authHeader) {
		return c.json({ error: 'Missing Authorization header' }, 401);
	}

	const token = authHeader.replace('Bearer ', '');

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);

	if (error || !user) {
		console.error('Auth error:', error);
		return c.json({ error: 'Unauthorized' }, 401);
	}

	c.set('user', user);
	await next();
});
