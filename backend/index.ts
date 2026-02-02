import { Hono } from 'hono';
import { cors } from 'hono/cors';
import organizationRoute from './routes/organization';
import userRoute from './routes/user';
import waitlistRoute from './routes/waitlist';
import featuresRoute from './routes/features';
import positionRoute from './routes/position';
import interviewRoute from './routes/interview';
import webhookRoute from './routes/webhook';

import { logger } from 'hono/logger';

const app = new Hono({ strict: true });

app.use(logger());
app.use(
	'/*',
	cors({
		origin: (origin) => {
			// Allow non-browser tools & preflight edge cases
			if (!origin) return origin; // Hono's cors helper treats this correctly for non-browser requests

			// Allow local development
			if (origin.includes('localhost')) return origin;
			// Allow all Vercel deployments (previews and production)
			if (origin.endsWith('.vercel.app')) return origin;
			// Allow production domain
			if (origin === 'https://evidenthire.in') return origin;

			return origin; // We return user provided origin to let browser decide, or providing null/undefined to block
		},
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
		exposeHeaders: ['Content-Length'],
		maxAge: 600,
		credentials: true,
	})
);

// Explicitly handle OPTIONS requests globally to avoid auth blocking them
app.use('/*', async (c, next) => {
	if (c.req.method === 'OPTIONS') {
		return c.body(null, 204);
	}
	await next();
});

// Check environment variables
if (!process.env.DATABASE_URL) {
	console.warn('WARNING: DATABASE_URL is not set. Database operations will fail.');
} else {
	// Mask password for logging
	const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
	console.log('Using DATABASE_URL:', maskedUrl);
}

// Create v1 router
const v1 = new Hono();

// Register routes to v1
v1.route('/users', userRoute);
v1.route('/organizations', organizationRoute);
v1.route('/waitlist', waitlistRoute);
v1.route('/features', featuresRoute);
v1.route('/positions', positionRoute);
v1.route('/interviews', interviewRoute);
v1.route('/webhooks/livekit', webhookRoute);

v1.get('/', (c) => {
	return c.text('EvidentHire Backend');
});

// Mount v1 router to main app
app.route('/api/v1', v1);

const port = parseInt(process.env.PORT || '8000');
console.log(`Server is running on port ${port}`);

export default {
	port,
	fetch: app.fetch,
};
