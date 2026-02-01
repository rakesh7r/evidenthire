import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
	getOrganizationMembers,
	updateMemberRole,
	removeMember,
	addMemberByEmail,
	updateOrganization,
} from '../services/organization.service';

const organization = new Hono<AuthEnv>();

organization.use('/*', authMiddleware);

organization.get('/members', async (c) => {
	const user = c.get('user');
	try {
		const members = await getOrganizationMembers(user.id);
		return c.json(members);
	} catch (err: any) {
		return c.json({ error: err.message }, 400);
	}
});

organization.post('/members', async (c) => {
	const user = c.get('user');
	const { email, role } = await c.req.json();

	if (!email) return c.json({ error: 'Email is required' }, 400);

	try {
		const newMember = await addMemberByEmail(user.id, email, role);
		return c.json(newMember);
	} catch (err: any) {
		return c.json({ error: err.message }, 400);
	}
});

organization.put('/members/:id', async (c) => {
	const user = c.get('user');
	const targetUserId = c.req.param('id');
	const { role } = await c.req.json();

	if (!role) return c.json({ error: 'Role is required' }, 400);

	try {
		const updated = await updateMemberRole(user.id, targetUserId, role);
		return c.json(updated);
	} catch (err: any) {
		return c.json({ error: err.message }, 400);
	}
});

organization.delete('/members/:id', async (c) => {
	const user = c.get('user');
	const targetUserId = c.req.param('id');

	try {
		await removeMember(user.id, targetUserId);
		return c.json({ success: true });
	} catch (err: any) {
		return c.json({ error: err.message }, 400);
	}
});

organization.put('/:id', async (c) => {
	const user = c.get('user');
	const orgId = c.req.param('id');
	const body = await c.req.json();

	try {
		const updated = await updateOrganization(user.id, orgId, body);
		return c.json(updated);
	} catch (err: any) {
		return c.json({ error: err.message }, 400);
	}
});

export default organization;
