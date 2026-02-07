import { sql } from '../db';

/**
 * Alter the existing application table to add missing columns for resume upload feature.
 *
 * Run with: bun run scripts/alter_application_table.ts
 */
async function alterApplicationTable() {
	try {
		console.log('Adding columns to application table...\n');

		// Add email column if not exists
		try {
			await sql`ALTER TABLE application ADD COLUMN IF NOT EXISTS email text`;
			console.log('✓ Added email column');
		} catch (e: any) {
			console.log('  email column: ', e.message || 'already exists or error');
		}

		// Add name column if not exists
		try {
			await sql`ALTER TABLE application ADD COLUMN IF NOT EXISTS name text`;
			console.log('✓ Added name column');
		} catch (e: any) {
			console.log('  name column: ', e.message || 'already exists or error');
		}

		// Add resume_s3_url column if not exists
		try {
			await sql`ALTER TABLE application ADD COLUMN IF NOT EXISTS resume_s3_url text`;
			console.log('✓ Added resume_s3_url column');
		} catch (e: any) {
			console.log('  resume_s3_url column: ', e.message || 'already exists or error');
		}

		// Add cv_analysis column if not exists
		try {
			await sql`ALTER TABLE application ADD COLUMN IF NOT EXISTS cv_analysis jsonb`;
			console.log('✓ Added cv_analysis column');
		} catch (e: any) {
			console.log('  cv_analysis column: ', e.message || 'already exists or error');
		}

		// Add status column if not exists
		try {
			await sql`ALTER TABLE application ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`;
			console.log('✓ Added status column');
		} catch (e: any) {
			console.log('  status column: ', e.message || 'already exists or error');
		}

		// Try to add unique constraint (email, position_id) if not exists
		try {
			await sql`
				DO $$ 
				BEGIN
					IF NOT EXISTS (
						SELECT 1 FROM pg_constraint 
						WHERE conname = 'application_email_position_id_key'
					) THEN
						ALTER TABLE application ADD CONSTRAINT application_email_position_id_key UNIQUE (email, position_id);
					END IF;
				END $$;
			`;
			console.log('✓ Added unique constraint on (email, position_id)');
		} catch (e: any) {
			console.log('  unique constraint: ', e.message || 'already exists or error');
		}

		console.log('\nDone! Verifying columns...\n');

		// Verify the columns
		const result = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'application'
            ORDER BY ordinal_position
        `;
		console.log('Application table columns:');
		for (const row of result) {
			console.log(`  - ${row.column_name}: ${row.data_type}`);
		}
	} catch (error) {
		console.error('Error:', error);
	} finally {
		process.exit(0);
	}
}

alterApplicationTable();
