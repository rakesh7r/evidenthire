import { sql } from '../db';

export const addJobDescriptionColumn = async () => {
	try {
		console.log('Adding job_description column to position table...');

		await sql`
			ALTER TABLE position 
			ADD COLUMN IF NOT EXISTS job_description TEXT
		`;

		console.log('Successfully added job_description column to position table');
	} catch (error) {
		console.error('Error adding job_description column:', error);
	} finally {
		process.exit(0);
	}
};

addJobDescriptionColumn();
