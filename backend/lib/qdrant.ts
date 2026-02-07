import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!qdrantUrl) {
	console.error('QDRANT_URL is not defined. Qdrant features will not work.');
	throw new Error('QDRANT_URL is not defined. Qdrant features will not work.');
}

if (!qdrantApiKey) {
	console.error('QDRANT_API_KEY is not defined. Qdrant features will not work.');
	throw new Error('QDRANT_API_KEY is not defined. Qdrant features will not work.');
}

export const qdrantClient = new QdrantClient({
	url: qdrantUrl,
	apiKey: qdrantApiKey,
});

console.log(`Qdrant client initialized with URL: ${qdrantUrl}`);
