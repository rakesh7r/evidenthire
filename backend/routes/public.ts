import { Hono } from 'hono';
import { sql } from '../db';

const app = new Hono();

// Helper to determine if string is UUID
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// Get Organization Details (Public)
app.get('/organizations/:id', async (c) => {
	const idOrSlug = c.req.param('id');
	try {
		let orgs;
		if (isUUID(idOrSlug)) {
			orgs = await sql`
                SELECT id, name, domain, city, country
                FROM organization
                WHERE id = ${idOrSlug}
            `;
		} else {
			// Search by name or domain (fuzzy match for slug-like behavior)
			orgs = await sql`
                SELECT id, name, domain, city, country
                FROM organization
                WHERE name ILIKE ${idOrSlug} OR domain ILIKE ${idOrSlug}
            `;
		}

		if (!orgs || orgs.length === 0) {
			return c.json({ error: 'Organization not found' }, 404);
		}

		return c.json(orgs[0]);
	} catch (error: any) {
		console.error('Error fetching organization:', error);
		return c.json({ error: 'Failed to fetch organization' }, 500);
	}
});

// Get Open Positions for Organization (Public)
app.get('/organizations/:id/positions', async (c) => {
	const idOrSlug = c.req.param('id');
	try {
		// Need organization ID first
		let orgId = idOrSlug;
		if (!isUUID(idOrSlug)) {
			const orgs = await sql`SELECT id FROM organization WHERE name ILIKE ${idOrSlug} OR domain ILIKE ${idOrSlug}`;
			if (!orgs || orgs.length === 0) {
				return c.json([], 200); // Organization not found, so no positions
			}
			orgId = orgs[0].id;
		}

		const positions = await sql`
            SELECT
                p.id,
                p.title,
                p.job_description,
                p.requirements,
                p.created_at as posted_at,
                p.status
            FROM position p
            WHERE p.organization_id = ${orgId}
            AND p.status = 'open'
            ORDER BY p.created_at DESC
        `;

		// Map to frontend expected format (adding defaults for missing columns)
		const mappedPositions = positions.map((p) => ({
			...p,
			description: p.job_description, // Fallback for 'description' if used
			department: 'Engineering', // Default/Placeholder
			location: 'Remote', // Default/Placeholder
			type: 'Full-time', // Default/Placeholder
		}));

		return c.json(mappedPositions);
	} catch (error: any) {
		console.error('Error fetching positions:', error);
		return c.json({ error: 'Failed to fetch positions' }, 500);
	}
});

export default app;
