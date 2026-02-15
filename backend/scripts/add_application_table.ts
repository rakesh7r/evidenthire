import { sql } from '../db';

/**
 * Migration script to add the application table for tracking job applications.
 * This table tracks (email, position_id) combinations with resume S3 URLs.
 *
 * Run with: npx tsx scripts/add_application_table.ts
 */
async function addApplicationTable() {
	try {
		console.log('Creating application table...');

		await sql`CREATE TABLE IF NOT EXISTS application (
              id               uuid primary key DEFAULT gen_random_uuid(),
              position_id      uuid references position(id) NOT NULL,
              email            text not null,
              name             text,
              resume_s3_url    text,
              cv_analysis      jsonb,
              status           text check (status in ('pending','reviewed','shortlisted','rejected')) DEFAULT 'pending',
              created_at       timestamptz not null default now(),
              updated_at       timestamptz not null default now(),
              UNIQUE(email, position_id)
            )`;

		console.log('Application table created successfully!');
		console.log('');
		console.log('Table schema:');
		console.log('  - id: UUID primary key');
		console.log('  - position_id: UUID (references position)');
		console.log('  - email: TEXT (candidate email, normalized to lowercase)');
		console.log('  - name: TEXT (candidate name)');
		console.log('  - resume_s3_url: TEXT (S3 URL of uploaded resume)');
		console.log('  - cv_analysis: JSONB (AI analysis results)');
		console.log('  - status: pending | reviewed | shortlisted | rejected');
		console.log('  - created_at, updated_at: timestamps');
		console.log('  - UNIQUE constraint on (email, position_id)');
	} catch (error) {
		console.error('Error creating application table:', error);
	} finally {
		process.exit(0);
	}
}

addApplicationTable();
