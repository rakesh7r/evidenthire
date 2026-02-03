import { sql } from '../db';

export const getPositionsByOrg = async (userId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		return [];
	}

	return await sql`
        SELECT p.*, COUNT(i.id)::int as candidates_count
        FROM position p
        LEFT JOIN interview i ON p.id = i.position_id
        WHERE p.organization_id = ${organization_id}
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `;
};

export const getPositionStats = async (userId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		return { total: 0, open: 0, closed: 0 };
	}

	const stats = await sql`
        SELECT 
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'open')::int as open,
            COUNT(*) FILTER (WHERE status = 'closed')::int as closed
        FROM position
        WHERE organization_id = ${organization_id}
    `;
	return stats[0];
};

export const getDashboardStats = async (userId: string) => {
	console.log('[getDashboardStats] Fetching stats for user:', userId);
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		console.log('[getDashboardStats] User organization not found for ID:', userId);
		return {
			open_positions: 0,
			total_interviews: 0,
			pending_reviews: 0,
		};
	}
	console.log('[getDashboardStats] Org ID:', organization_id);

	const [posStats, intStats] = await Promise.all([
		sql`SELECT COUNT(*)::int as open_positions FROM position WHERE organization_id = ${organization_id} AND status = 'open'`,
		sql`SELECT 
				COUNT(*)::int as total_interviews,
				COUNT(*) FILTER (WHERE i.status = 'scheduled')::int as pending_reviews
			FROM interview i
			JOIN position p ON i.position_id = p.id
			WHERE p.organization_id = ${organization_id}`,
	]);

	return {
		...posStats[0],
		...intStats[0],
	};
};

export const getPositionById = async (userId: string, positionId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		throw new Error('User is not part of an organization');
	}

	const positions = await sql`
        SELECT * FROM position 
        WHERE id = ${positionId} AND organization_id = ${organization_id}
    `;
	return positions[0];
};

export const createPosition = async (
	userId: string,
	data: { title: string; requirements?: any; rounds?: any; status?: string }
) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can create positions');
	}

	const result = await sql`
        INSERT INTO position (organization_id, title, requirements, rounds, status)
        VALUES (${userData.organization_id}, ${data.title}, ${data.requirements || {}}, ${data.rounds || []}, ${
		data.status || 'open'
	})
        RETURNING *
    `;
	return result[0];
};

export const updatePosition = async (
	userId: string,
	positionId: string,
	data: { title?: string; requirements?: any; rounds?: any; status?: string }
) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can update positions');
	}

	const updatePayload: any = {};
	if (data.title !== undefined) updatePayload.title = data.title;
	if (data.requirements !== undefined) updatePayload.requirements = data.requirements;
	if (data.rounds !== undefined) updatePayload.rounds = data.rounds;
	if (data.status !== undefined) updatePayload.status = data.status;

	if (Object.keys(updatePayload).length === 0) {
		return await getPositionById(userId, positionId);
	}

	const result = await sql`
        UPDATE position 
        SET ${sql(updatePayload)}
        WHERE id = ${positionId} AND organization_id = ${userData.organization_id}
        RETURNING *
    `;
	return result[0];
};

export const deletePosition = async (userId: string, positionId: string) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can delete positions');
	}

	const result = await sql`
        DELETE FROM position 
        WHERE id = ${positionId} AND organization_id = ${userData.organization_id}
        RETURNING id
    `;

	if (!result[0]) {
		throw new Error('Position not found or unauthorized');
	}

	return result[0];
};
