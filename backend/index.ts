import { Hono } from 'hono';
import { cors } from 'hono/cors';
import organizationRoute from './routes/organization';
import userRoute from './routes/user';
import waitlistRoute from './routes/waitlist';
import featuresRoute from './routes/features';
import positionRoute from './routes/position';

import { logger } from 'hono/logger';

const app = new Hono({ strict: true });

app.use(logger());
app.use('/*', cors());

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
