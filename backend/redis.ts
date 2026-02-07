import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
export const redis = new Redis(REDIS_URL, {
	maxRetriesPerRequest: 3,
	lazyConnect: true,
});

redis.on('connect', () => {
	console.log('Redis connected');
});

redis.on('error', (err) => {
	console.error('Redis error:', err);
});

// Connect to Redis (non-blocking)
redis.connect().catch((err) => {
	console.warn('Redis connection failed, chunk indexing will fall back to DB:', err.message);
});

// Key generators
const CHUNK_INDEX_KEY = (interviewId: string) => `interview:${interviewId}:chunk_index`;

/**
 * Get the next chunk index for an interview
 * Increments atomically in Redis
 */
export const getNextChunkIndex = async (interviewId: string, fallbackIndex: number = 0): Promise<number> => {
	try {
		// Check if key exists, if not initialize from fallback
		const exists = await redis.exists(CHUNK_INDEX_KEY(interviewId));
		if (!exists) {
			await redis.set(CHUNK_INDEX_KEY(interviewId), fallbackIndex);
		}

		// Increment and return new value
		const newIndex = await redis.incr(CHUNK_INDEX_KEY(interviewId));
		return newIndex;
	} catch (err) {
		console.error('Redis getNextChunkIndex error:', err);
		// Fallback: return fallback + 1
		return fallbackIndex + 1;
	}
};

/**
 * Get current chunk index without incrementing
 */
export const getCurrentChunkIndex = async (interviewId: string): Promise<number> => {
	try {
		const value = await redis.get(CHUNK_INDEX_KEY(interviewId));
		return value ? parseInt(value, 10) : 0;
	} catch (err) {
		console.error('Redis getCurrentChunkIndex error:', err);
		return 0;
	}
};

/**
 * Initialize chunk index from database value
 */
export const initChunkIndex = async (interviewId: string, startIndex: number): Promise<void> => {
	try {
		await redis.set(CHUNK_INDEX_KEY(interviewId), startIndex);
		console.log(`Initialized chunk index for ${interviewId} to ${startIndex}`);
	} catch (err) {
		console.error('Redis initChunkIndex error:', err);
	}
};

/**
 * Get and clear chunk index (for persisting to DB)
 */
export const getAndClearChunkIndex = async (interviewId: string): Promise<number> => {
	try {
		const value = await redis.getdel(CHUNK_INDEX_KEY(interviewId));
		return value ? parseInt(value, 10) : 0;
	} catch (err) {
		console.error('Redis getAndClearChunkIndex error:', err);
		return 0;
	}
};
