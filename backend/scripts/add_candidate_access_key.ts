import { sql } from '../db';

const addCandidateAccessKey = async () => {
	try {
		console.log('Adding candidate_access_key column to interview table...');

		await sql`
            ALTER TABLE interview 
            ADD COLUMN IF NOT EXISTS candidate_access_key TEXT;
        `;

		console.log('Successfully added candidate_access_key column.');
	} catch (error) {
		console.error('Error adding column:', error);
	} finally {
		process.exit(0);
	}
};

addCandidateAccessKey();
