import { sql } from '../db';

async function migrate() {
	console.log('Migrating database for Rounds feature...');

	try {
		// Add rounds column to position
		console.log('Adding rounds to position table...');
		await sql`ALTER TABLE position ADD COLUMN IF NOT EXISTS rounds jsonb DEFAULT '[]'::jsonb`;

		// Add round info to interview
		console.log('Adding round info to interview table...');
		await sql`ALTER TABLE interview ADD COLUMN IF NOT EXISTS round_title text`;
		await sql`ALTER TABLE interview ADD COLUMN IF NOT EXISTS round_type text`;

		console.log('Migration complete!');
	} catch (err) {
		console.error('Migration failed:', err);
		process.exit(1);
	}

	process.exit(0);
}

migrate();
