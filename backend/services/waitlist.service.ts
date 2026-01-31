import { sql } from '../db';

export const addToWaitlist = async (email: string) => {
	try {
		const result = await sql`
            INSERT INTO waitlist (email)
            VALUES (${email})
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING *
        `;
		return result[0];
	} catch (err) {
		console.error('Waitlist DB error:', err);
		throw new Error('Failed to add to waitlist');
	}
};

export const getWaitlistUsers = async () => {
	try {
		const result = await sql`
            SELECT * FROM waitlist ORDER BY created_at DESC
        `;
		return result;
	} catch (err) {
		console.error('Waitlist DB error:', err);
		throw new Error('Failed to get waitlist users');
	}
};
