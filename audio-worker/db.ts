import postgres from 'postgres';
import 'dotenv/config';

// Database connection
export const sql = postgres(process.env.DATABASE_URL || '', {
	ssl: 'require',
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10,
});
