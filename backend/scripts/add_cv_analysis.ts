import { sql } from '../db';

export const addCvAnalysisColumn = async () => {
	try {
		await sql`
            ALTER TABLE candidate
            ADD COLUMN IF NOT EXISTS cv_analysis JSONB;
        `;
		console.log('Added cv_analysis column to candidate table');
	} catch (error) {
		console.error('Error adding cv_analysis column:', error);
	} finally {
		process.exit(0);
	}
};

addCvAnalysisColumn();
