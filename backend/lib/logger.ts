import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	base: {
		env: process.env.NODE_ENV || 'development',
	},
	transport: isDevelopment
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					ignore: 'pid,hostname',
					translateTime: 'HH:MM:ss Z',
				},
		  }
		: undefined,
});

export default logger;
