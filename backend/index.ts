import { Hono } from 'hono';
import { cors } from 'hono/cors';
import userRoute from './routes/user';

const app = new Hono();

app.use('/*', cors());

// Check environment variables
if (!process.env.DATABASE_URL) {
	console.warn('WARNING: DATABASE_URL is not set. Database operations will fail.');
}

// Register routes
app.route('/users', userRoute);

app.get('/', (c) => {
	return c.text('Evident Hiring Backend');
});

const port = 8000;
console.log(`Server is running on port ${port}`);

export default {
	port,
	fetch: app.fetch,
};
