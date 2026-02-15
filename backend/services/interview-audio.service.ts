import { sql } from '../db';
import { getNextChunkIndex, initChunkIndex, getAndClearChunkIndex, getCurrentChunkIndex } from '../redis';

/**
 * Get or create the audio folder path for an interview
 * Returns the folder path and initializes Redis with the last chunk index if needed
 */
export const getOrCreateAudioFolder = async (
	interviewId: string
): Promise<{ audioFolderPath: string; isNew: boolean }> => {
	// Check if interview already has an audio folder
	const result = await sql`
        SELECT audio_folder_path, last_chunk_index 
        FROM interview 
        WHERE id = ${interviewId}
    `;

	if (result[0]?.audio_folder_path) {
		// Folder exists, initialize Redis with last chunk index if needed
		const lastIndex = result[0].last_chunk_index || 0;
		const currentRedisIndex = await getCurrentChunkIndex(interviewId);

		if (currentRedisIndex === 0 && lastIndex > 0) {
			await initChunkIndex(interviewId, lastIndex);
		}

		return { audioFolderPath: result[0].audio_folder_path, isNew: false };
	}

	// Create new audio folder path
	const audioFolderPath = `${interviewId}/audio`;

	await sql`
        UPDATE interview 
        SET audio_folder_path = ${audioFolderPath}, last_chunk_index = 0
        WHERE id = ${interviewId}
    `;

	// Initialize Redis
	await initChunkIndex(interviewId, 0);

	console.log(`Created audio folder path for interview ${interviewId}: ${audioFolderPath}`);
	return { audioFolderPath, isNew: true };
};

/**
 * Get the next chunk index for a participant in an interview
 * Uses Redis for fast atomic increments, with DB fallback
 */
export const getNextAudioChunkIndex = async (interviewId: string): Promise<number> => {
	// Get from DB first to initialize Redis if needed
	const result = await sql`
        SELECT last_chunk_index FROM interview WHERE id = ${interviewId}
    `;
	const dbIndex = result[0]?.last_chunk_index || 0;

	// Get next index from Redis (atomic increment)
	const nextIndex = await getNextChunkIndex(interviewId, dbIndex);
	return nextIndex;
};

/**
 * Persist the current chunk index from Redis to database
 * Call this when the interview ends or session ends
 */
export const persistChunkIndex = async (interviewId: string): Promise<void> => {
	const currentIndex = await getAndClearChunkIndex(interviewId);

	if (currentIndex > 0) {
		await sql`
            UPDATE interview 
            SET last_chunk_index = ${currentIndex}
            WHERE id = ${interviewId}
        `;
		console.log(`Persisted chunk index ${currentIndex} for interview ${interviewId}`);
	}
};

/**
 * Get audio folder info for an interview
 */
export const getAudioFolderInfo = async (
	interviewId: string
): Promise<{ audioFolderPath: string | null; lastChunkIndex: number }> => {
	const result = await sql`
        SELECT audio_folder_path, last_chunk_index 
        FROM interview 
        WHERE id = ${interviewId}
    `;

	return {
		audioFolderPath: result[0]?.audio_folder_path || null,
		lastChunkIndex: result[0]?.last_chunk_index || 0,
	};
};
