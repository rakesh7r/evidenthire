import { sql } from '../db';

export const getPipeline = async (userId: string, positionId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		throw new Error('User is not part of an organization');
	}

	// Verify position belongs to org
	const position = await sql`SELECT id FROM position WHERE id = ${positionId} AND organization_id = ${organization_id}`;
	if (!position[0]) {
		throw new Error('Position not found or unauthorized');
	}

	const stages = await sql`
        SELECT * FROM position_stage 
        WHERE position_id = ${positionId} 
        ORDER BY order_index ASC
    `;

	// Fetch candidates associated with this position.
	// We look for candidates who have an interview for this position, OR correspond to an application entry.
	// Since `Interview` is the legacy main link, we primarily look there.

	// Note: A candidate might have multiple interviews. We want unique candidates.
	// We'll prioritize the Application's stage info.

	const candidates = await sql`
        SELECT DISTINCT ON (c.id)
            c.id, 
            c.name, 
            c.email,
            a.stage_id,
            a.updated_at as stage_updated_at,
            i.status as last_interview_status,
            i.scheduled_start as last_interview_date
        FROM candidate c
        JOIN interview i ON c.id = i.candidate_id AND i.position_id = ${positionId}
        LEFT JOIN application a ON c.id = a.candidate_id AND a.position_id = ${positionId}
        ORDER BY c.id, i.scheduled_start DESC
    `;

	return {
		stages,
		candidates,
	};
};

export const updatePipelineStages = async (
	userId: string,
	positionId: string,
	stages: { id?: string; name: string }[]
) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized');
	}

	// Verify position
	const position =
		await sql`SELECT id FROM position WHERE id = ${positionId} AND organization_id = ${userData.organization_id}`;
	if (!position[0]) {
		throw new Error('Position not found or unauthorized');
	}

	return await sql.begin(async (tx) => {
		// 1. Get existing stages
		const existingStages = await (tx as any)`SELECT id FROM position_stage WHERE position_id = ${positionId}`;
		const existingIds = new Set<string>(existingStages.map((s: any) => s.id));
		// Filter undefined IDs from incoming stages
		const incomingIds = new Set<string>(stages.map((s) => s.id).filter((id): id is string => !!id));

		// 2. Delete removed stages
		// (Candidates in these stages will have stage_id set to NULL via ON DELETE SET NULL)
		const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
		if (toDelete.length > 0) {
			await (tx as any)`DELETE FROM position_stage WHERE id IN ${(tx as any)(toDelete)}`;
		}

		// 3. Upsert stages
		const resultStages = [];
		for (const [i, stage] of stages.entries()) {
			if (stage.id && existingIds.has(stage.id)) {
				// Update
				const updated = await (tx as any)`
                    UPDATE position_stage 
                    SET name = ${stage.name}, order_index = ${i}
                    WHERE id = ${stage.id}
                    RETURNING *
                `;
				resultStages.push(updated[0]);
			} else {
				// Insert
				const inserted = await (tx as any)`
                    INSERT INTO position_stage (position_id, name, order_index)
                    VALUES (${positionId}, ${stage.name}, ${i})
                    RETURNING *
                `;
				resultStages.push(inserted[0]);
			}
		}

		return resultStages;
	});
};

export const moveCandidate = async (
	userId: string,
	positionId: string,
	candidateId: string,
	stageId: string | null
) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];
	if (!userData?.organization_id) throw new Error('Unauthorized');

	// Verify position
	const position =
		await sql`SELECT id FROM position WHERE id = ${positionId} AND organization_id = ${userData.organization_id}`;
	if (!position[0]) throw new Error('Position not found');

	// Verify stage if provided
	if (stageId) {
		const stage = await sql`SELECT id FROM position_stage WHERE id = ${stageId} AND position_id = ${positionId}`;
		if (!stage[0]) throw new Error('Stage not found');
	}

	// Upsert Application record
	// We use ON CONFLICT to update
	return await sql`
        INSERT INTO application (position_id, candidate_id, stage_id, updated_at)
        VALUES (${positionId}, ${candidateId}, ${stageId}, NOW())
        ON CONFLICT (position_id, candidate_id)
        DO UPDATE SET stage_id = ${stageId}, updated_at = NOW()
        RETURNING *
    `;
};
