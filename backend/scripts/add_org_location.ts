import { sql } from '../db';

const migrate = async () => {
	try {
		console.log('Adding city and country columns to organization table...');
		await sql`
            ALTER TABLE organization 
            ADD COLUMN IF NOT EXISTS city text,
            ADD COLUMN IF NOT EXISTS country text
        `;
		console.log('Migration successful');
	} catch (err) {
		console.error('Migration failed:', err);
	}
	process.exit(0);
};

migrate();
