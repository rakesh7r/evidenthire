import postgres from 'postgres';

// Database connection
export const sql = postgres(process.env.DATABASE_URL || '');
