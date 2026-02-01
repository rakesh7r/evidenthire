import { sql } from '../db';
import { notifyInterviewScheduled, notifyInterviewCancelled } from './email.service';

export const getInterviewsByOrg = async (userId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		return [];
	}

	return await sql`
        SELECT 
            i.*, 
            c.name as candidate_name, 
            c.email as candidate_email,
            p.title as position_title,
            (
                SELECT array_agg(user_id) 
                FROM interview_participant 
                WHERE interview_id = i.id
            ) as interviewer_ids
        FROM interview i
        JOIN candidate c ON i.candidate_id = c.id
        JOIN position p ON i.position_id = p.id
        WHERE p.organization_id = ${organization_id}
        ORDER BY i.scheduled_start DESC
    `;
};

export const getInterviewById = async (userId: string, interviewId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		throw new Error('User is not part of an organization');
	}

	const interviews = await sql`
        SELECT 
            i.*, 
            c.name as candidate_name, 
            c.email as candidate_email,
            p.title as position_title,
            (
                SELECT array_agg(user_id) 
                FROM interview_participant 
                WHERE interview_id = i.id
            ) as interviewer_ids
        FROM interview i
        JOIN candidate c ON i.candidate_id = c.id
        JOIN position p ON i.position_id = p.id
        WHERE i.id = ${interviewId} AND p.organization_id = ${organization_id}
    `;
	return interviews[0];
};

export const getPublicInterviewById = async (interviewId: string) => {
	const interviews = await sql`
        SELECT 
            i.id,
            i.scheduled_start,
            i.status,
            c.name as candidate_name, 
            p.title as position_title,
            o.name as organization_name
        FROM interview i
        JOIN candidate c ON i.candidate_id = c.id
        JOIN position p ON i.position_id = p.id
        JOIN organization o ON p.organization_id = o.id
        WHERE i.id = ${interviewId}
    `;
	return interviews[0];
};

export const createInterview = async (
	userId: string,
	data: {
		candidateName: string;
		candidateEmail: string;
		positionId: string;
		date: string;
		time: string;
		interviewerIds: string[];
	}
) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can schedule interviews');
	}

	const result = await sql.begin(async (tx: any) => {
		// 1. Get or create candidate
		let candidate = await tx`SELECT id FROM candidate WHERE email = ${data.candidateEmail}`;
		if (!candidate[0]) {
			candidate = await tx`
                INSERT INTO candidate (name, email)
                VALUES (${data.candidateName}, ${data.candidateEmail})
                RETURNING id
            `;
		} else {
			// Update name if candidate already exists
			await tx`
				UPDATE candidate 
				SET name = ${data.candidateName} 
				WHERE id = ${candidate[0].id}
			`;
		}

		const candidateId = candidate[0].id;
		const scheduledStart = new Date(`${data.date}T${data.time}`);

		// 2. Create interview
		const interview = await tx`
            INSERT INTO interview (position_id, candidate_id, scheduled_start, status)
            VALUES (${data.positionId}, ${candidateId}, ${scheduledStart}, 'scheduled')
            RETURNING *
        `;

		const interviewRow = interview[0];
		if (!interviewRow) throw new Error('Failed to create interview');
		const interviewId = interviewRow.id;

		// 3. Add participants
		if (data.interviewerIds && data.interviewerIds.length > 0) {
			const participants = data.interviewerIds.map((interviewerId) => ({
				interview_id: interviewId,
				user_id: interviewerId,
				role: 'interviewer',
			}));
			await tx`INSERT INTO interview_participant ${tx(participants)}`;
		}

		return {
			...interviewRow,
			candidate_name: data.candidateName,
			candidate_email: data.candidateEmail,
			interviewer_ids: data.interviewerIds,
		};
	});

	// Send notification emails (after transaction)
	try {
		const fullDetails = await sql`
			SELECT 
				i.*, 
				c.name as candidate_name, 
				c.email as candidate_email,
				p.title as position_title,
				(
					SELECT array_agg(u.email) 
					FROM interview_participant ip
					JOIN user_account u ON ip.user_id = u.id
					WHERE ip.interview_id = i.id
				) as interviewer_emails
			FROM interview i
			JOIN candidate c ON i.candidate_id = c.id
			JOIN position p ON i.position_id = p.id
			WHERE i.id = ${result.id}
		`;

		const interview = fullDetails[0];
		if (interview) {
			notifyInterviewScheduled({
				interviewId: interview.id,
				candidateEmail: interview.candidate_email,
				candidateName: interview.candidate_name,
				positionTitle: interview.position_title,
				scheduledStart: new Date(interview.scheduled_start),
				interviewerEmails: interview.interviewer_emails || [],
			});
		}
	} catch (err) {
		console.error('Failed to send notification emails:', err);
	}

	return result;
};

export const updateInterview = async (
	userId: string,
	interviewId: string,
	data: {
		candidateName?: string;
		candidateEmail?: string;
		positionId?: string;
		date?: string;
		time?: string;
		interviewerIds?: string[];
		status?: string;
	}
) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can update interviews');
	}

	return await sql.begin(async (tx: any) => {
		// Verify interview belongs to user's org
		const existing = await tx`
            SELECT i.id, i.candidate_id 
            FROM interview i
            JOIN position p ON i.position_id = p.id
            WHERE i.id = ${interviewId} AND p.organization_id = ${userData.organization_id}
        `;

		const existingRow = existing[0];
		if (!existingRow) {
			throw new Error('Interview not found or unauthorized');
		}

		const candidateId = existingRow.candidate_id;

		// 1. Update Candidate if name/email changed
		if (data.candidateName || data.candidateEmail) {
			const updateObj: any = {};
			if (data.candidateName) updateObj.name = data.candidateName;
			if (data.candidateEmail) updateObj.email = data.candidateEmail;
			await tx`UPDATE candidate SET ${tx(updateObj)} WHERE id = ${candidateId}`;
		}

		// 2. Update Interview
		const interviewUpdate: any = {};
		if (data.positionId) interviewUpdate.position_id = data.positionId;
		if (data.status) interviewUpdate.status = data.status;
		if (data.date || data.time) {
			// Need to fetch existing date/time if only one provided
			const current = await tx`SELECT scheduled_start FROM interview WHERE id = ${interviewId}`;
			const row = current[0];
			if (!row) throw new Error('Interview not found');
			const currentStart = new Date((row as any).scheduled_start);
			const isoParts = currentStart.toISOString().split('T');
			const dateStr = data.date || isoParts[0];
			const timePart = isoParts[1];
			if (!dateStr || !timePart) throw new Error('Invalid date format');
			const timeStr = data.time || timePart.substring(0, 5);
			interviewUpdate.scheduled_start = new Date(`${dateStr}T${timeStr}`);
		}

		let updatedInterview;
		if (Object.keys(interviewUpdate).length > 0) {
			updatedInterview = await tx`
                UPDATE interview SET ${tx(interviewUpdate)}
                WHERE id = ${interviewId}
                RETURNING *
            `;
		} else {
			const res = await tx`SELECT * FROM interview WHERE id = ${interviewId}`;
			updatedInterview = res;
		}

		// 3. Update Participants
		if (data.interviewerIds !== undefined) {
			// Simple approach: delete all and re-add
			await tx`DELETE FROM interview_participant WHERE interview_id = ${interviewId}`;
			if (data.interviewerIds.length > 0) {
				const participants = data.interviewerIds.map((interviewerId) => ({
					interview_id: interviewId,
					user_id: interviewerId,
					role: 'interviewer',
				}));
				await tx`INSERT INTO interview_participant ${tx(participants)}`;
			}
		}

		const finalRow = updatedInterview[0];
		if (!finalRow) throw new Error('Failed to update interview');
		return finalRow;
	});
};

export const deleteInterview = async (userId: string, interviewId: string) => {
	const user = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const userData = user[0];

	if (!userData || !userData.organization_id) {
		throw new Error('User is not part of an organization');
	}

	if (!['admin', 'recruiter'].includes(userData.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can delete interviews');
	}

	// Fetch details before deletion for notification
	const interviewDetails = await sql`
		SELECT 
			i.*, 
			c.name as candidate_name, 
			c.email as candidate_email,
			p.title as position_title,
			(
				SELECT array_agg(u.email) 
				FROM interview_participant ip
				JOIN user_account u ON ip.user_id = u.id
				WHERE ip.interview_id = i.id
			) as interviewer_emails
		FROM interview i
		JOIN candidate c ON i.candidate_id = c.id
		JOIN position p ON i.position_id = p.id
		WHERE i.id = ${interviewId}
	`;
	const interview = interviewDetails[0];

	const result = await sql.begin(async (tx: any) => {
		// Verify interview belongs to user's org
		const existing = await tx`
            SELECT i.id 
            FROM interview i
            JOIN position p ON i.position_id = p.id
            WHERE i.id = ${interviewId} AND p.organization_id = ${userData.organization_id}
        `;

		if (!existing[0]) {
			throw new Error('Interview not found or unauthorized');
		}

		// Delete participants first (due to foreign key)
		await tx`DELETE FROM interview_participant WHERE interview_id = ${interviewId}`;

		// Delete interview
		const deleteRes = await tx`
            DELETE FROM interview 
            WHERE id = ${interviewId}
            RETURNING id
        `;

		const deletedRow = deleteRes[0];
		if (!deletedRow) throw new Error('Failed to delete interview');
		return deletedRow;
	});

	// Send cancellation emails
	if (interview) {
		try {
			notifyInterviewCancelled({
				candidateEmail: interview.candidate_email,
				candidateName: interview.candidate_name,
				positionTitle: interview.position_title,
				scheduledStart: new Date(interview.scheduled_start),
				interviewerEmails: interview.interviewer_emails || [],
			});
		} catch (err) {
			console.error('Failed to send cancellation emails:', err);
		}
	}

	return result;
};
