import { sql } from '../db';

const migrate = async () => {
	try {
		console.log('Dropping city and country columns from user_account table...');
		await sql`
            ALTER TABLE user_account 
            DROP COLUMN IF EXISTS city,
            DROP COLUMN IF EXISTS country
        `;
		console.log('Migration successful');
	} catch (err) {
		console.error('Migration failed:', err);
	}
	process.exit(0);
};

migrate();
