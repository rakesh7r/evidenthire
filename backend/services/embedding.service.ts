import openai from '../lib/openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding vector for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
	// Truncate text to avoid token limits (roughly 8000 tokens = ~32000 chars)
	const truncatedText = text.slice(0, 30000);

	try {
		const response = await openai.embeddings.create({
			model: EMBEDDING_MODEL,
			input: truncatedText,
		});

		return response.data[0]?.embedding || [];
	} catch (error) {
		console.error('Error generating embedding:', error);
		throw new Error('Failed to generate embedding');
	}
}

export { EMBEDDING_DIMENSIONS };
