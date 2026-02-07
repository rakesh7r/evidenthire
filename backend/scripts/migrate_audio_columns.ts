import { sql } from '../db';

/**
 * Migration: Add audio storage columns to interview table
 * Run this to add the new columns for session-less audio storage
 */
export const migrateAddAudioColumns = async () => {
	try {
		console.log('Adding audio_folder_path column to interview table...');
		await sql`
			ALTER TABLE interview 
			ADD COLUMN IF NOT EXISTS audio_folder_path text
		`;

		console.log('Adding last_chunk_index column to interview table...');
		await sql`
			ALTER TABLE interview 
			ADD COLUMN IF NOT EXISTS last_chunk_index integer DEFAULT 0
		`;

		console.log('Migration completed successfully!');
	} catch (error) {
		console.error('Migration error:', error);
		throw error;
	} finally {
		process.exit(0);
	}
};

migrateAddAudioColumns();
