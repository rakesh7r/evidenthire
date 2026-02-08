import { sql } from '../db';

/**
 * Cleanup script to remove session-related tables and constraints
 * This is necessary to fully transition to the new simplified audio architecture
 */
const cleanupSessionTables = async () => {
	try {
		console.log('Starting cleanup of session tables...');

		// 1. Drop constraints from media_chunk if they exist
		try {
			console.log('Dropping foreign key constraints on media_chunk...');
			await sql`ALTER TABLE media_chunk DROP CONSTRAINT IF EXISTS media_chunk_session_id_fkey`;
			await sql`ALTER TABLE media_chunk DROP CONSTRAINT IF EXISTS media_chunk_participant_id_fkey`;

			// Drop columns if we are not using them anymore (we should clean up media_chunk)
			await sql`ALTER TABLE media_chunk DROP COLUMN IF EXISTS session_id`;
			await sql`ALTER TABLE media_chunk DROP COLUMN IF EXISTS participant_id`;

			// Make participant_identity easier to use directly on media_chunk if needed
			// But currently the audio flow doesn't use media_chunk table much, relies on S3
		} catch (e: any) {
			console.log('Error modifying media_chunk:', e.message);
		}

		// 2. Drop session_participant table
		try {
			console.log('Dropping session_participant table...');
			await sql`DROP TABLE IF EXISTS session_participant CASCADE`;
		} catch (e: any) {
			console.log('Error dropping session_participant:', e.message);
		}

		// 3. Drop interview_session table
		try {
			console.log('Dropping interview_session table...');
			await sql`DROP TABLE IF EXISTS interview_session CASCADE`;
		} catch (e: any) {
			console.log('Error dropping interview_session:', e.message);
		}

		console.log('Cleanup completed successfully!');
	} catch (error) {
		console.error('Cleanup error:', error);
	} finally {
		process.exit(0);
	}
};

cleanupSessionTables();
