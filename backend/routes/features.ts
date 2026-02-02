import { Hono } from 'hono';
import { sql } from '../db';

const features = new Hono();

features.get('/', async (c) => {
	try {
		const flags = await sql`SELECT feature, is_enabled FROM feature_flags`;
		// Convert array of objects to simple object: { feature_name: boolean }
		const flagsMap = flags.reduce((acc: any, curr: any) => {
			acc[curr.feature] = curr.is_enabled;
			return acc;
		}, {});
		return c.json(flagsMap);
	} catch (err) {
		console.error('Error fetching feature flags:', err);
		return c.json({ error: 'Failed to fetch feature flags' }, 500);
	}
});

export default features;
