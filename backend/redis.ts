import Redis from 'ioredis';

const createRedisClient = () => {
	const commonOptions = {
		maxRetriesPerRequest: 3,
		lazyConnect: true,
	};

	if (process.env.REDIS_HOST_URL) {
		console.log('Using Redis Cloud configuration');
		return new Redis({
			...commonOptions,
			host: process.env.REDIS_HOST_URL,
			port: parseInt(process.env.REDIS_PORT || '6379'),
			username: process.env.REDIS_USERNAME,
			password: process.env.REDIS_PASSWORD,
		});
	}

	const REDIS_URL = process.env.REDIS_URL;
	if (!REDIS_URL) {
		throw new Error('REDIS_URL not set');
	}
	console.log(`Using Redis URL: ${REDIS_URL.includes('localhost') ? 'localhost' : 'remote'}`);
	return new Redis(REDIS_URL, commonOptions);
};

// Create Redis client
export const redis = createRedisClient();

redis.on('connect', () => {
	console.log('Redis connected');
});

redis.on('error', (err) => {
	console.error('Redis error:', err);
});

// Connect to Redis (blocking with await)
try {
	await redis.connect();
} catch (err: any) {
	console.warn('Redis connection failed, chunk indexing will fall back to DB:', err.message);
}

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
