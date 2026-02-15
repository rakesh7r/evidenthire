import Redis from 'ioredis';
import logger from './lib/logger';

const createRedisClient = () => {
	const commonOptions = {
		maxRetriesPerRequest: 3,
		lazyConnect: true,
	};

	if (process.env.REDIS_HOST_URL) {
		logger.info('Using Redis Cloud configuration');
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
	logger.info({ remote: !REDIS_URL.includes('localhost') }, 'Using Redis');
	return new Redis(REDIS_URL, commonOptions);
};

// Create Redis client
export const redis = createRedisClient();

redis.on('connect', () => {
	logger.info('Redis connected');
});

redis.on('error', (err) => {
	logger.error({ error: String(err) }, 'Redis error');
});

// Connect to Redis (blocking with await)
try {
	await redis.connect();
} catch (err: any) {
	logger.warn({ error: err.message }, 'Redis connection failed, chunk indexing will fall back to DB');
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
		logger.error({ error: String(err), interviewId }, 'Redis getNextChunkIndex error');
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
		logger.error({ error: String(err), interviewId }, 'Redis getCurrentChunkIndex error');
		return 0;
	}
};

/**
 * Initialize chunk index from database value
 */
export const initChunkIndex = async (interviewId: string, startIndex: number): Promise<void> => {
	try {
		await redis.set(CHUNK_INDEX_KEY(interviewId), startIndex);
		logger.info({ interviewId, startIndex }, 'Initialized chunk index');
	} catch (err) {
		logger.error({ error: String(err), interviewId }, 'Redis initChunkIndex error');
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
		logger.error({ error: String(err), interviewId }, 'Redis getAndClearChunkIndex error');
		return 0;
	}
};
