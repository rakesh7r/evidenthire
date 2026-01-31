import { sql } from '../db';

export interface User {
	id: string;
	email: string;
}

export const createUser = async (user: User) => {
	try {
		const result = await sql`
      INSERT INTO users (id, email)
      VALUES (${user.id}, ${user.email})
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
      RETURNING *
    `;
		return result[0];
	} catch (err) {
		console.error('Database error details:', err);
		throw new Error('Failed to create user record');
	}
};
