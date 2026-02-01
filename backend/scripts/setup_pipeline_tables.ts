import { sql } from '../db';

const setupPipelineTables = async () => {
	console.log('Setting up pipeline tables...');

	try {
		await sql`
            CREATE TABLE IF NOT EXISTS position_stage (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                position_id UUID REFERENCES position(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
		console.log('Created position_stage table.');

		await sql`
            CREATE TABLE IF NOT EXISTS application (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                position_id UUID REFERENCES position(id) ON DELETE CASCADE,
                candidate_id UUID REFERENCES candidate(id) ON DELETE CASCADE,
                stage_id UUID REFERENCES position_stage(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(position_id, candidate_id)
            );
        `;
		console.log('Created application table.');

		console.log('Pipeline tables setup completed.');
	} catch (err) {
		console.error('Failed to setup pipeline tables:', err);
	} finally {
		process.exit(0);
	}
};

setupPipelineTables();
