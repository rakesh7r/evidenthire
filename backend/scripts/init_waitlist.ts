import { sql } from '../db';

export const createWaitlistTable = async () => {
	try {
		await sql`
            CREATE TABLE IF NOT EXISTS waitlist (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
		console.log('Waitlist table created successfully');
	} catch (error) {
		console.error('Error creating waitlist table:', error);
	} finally {
		process.exit(0);
	}
};

createWaitlistTable();
