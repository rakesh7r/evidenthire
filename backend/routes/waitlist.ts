import { Hono } from 'hono';
import { addToWaitlist, getWaitlistUsers } from '../services/waitlist.service';

const waitlist = new Hono();

waitlist.get('/', async (c) => {
	try {
		const users = await getWaitlistUsers();
		return c.json({ success: true, users });
	} catch (err) {
		console.error('Waitlist controller error:', err);
		return c.json({ error: 'Failed to fetch waitlist users' }, 500);
	}
});

waitlist.post('/', async (c) => {
	const { email } = await c.req.json();

	if (!email || !/\S+@\S+\.\S+/.test(email)) {
		return c.json({ error: 'Valid email is required' }, 400);
	}

	try {
		await addToWaitlist(email);
		return c.json({ success: true, message: 'Added to waitlist' });
	} catch (err) {
		// Log sensitive error details to console, return generic to user
		console.error('Waitlist controller error:', err);
		return c.json({ error: 'Failed to join waitlist' }, 500);
	}
});

export default waitlist;
