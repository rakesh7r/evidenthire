import { createClient } from '@supabase/supabase-js';
import { sql } from '../db';

export const getOrganizationMembers = async (userId: string) => {
	// First get the requester's org ID
	const requesters = await sql`SELECT organization_id, role FROM user_account WHERE id = ${userId}`;
	const requester = requesters[0];

	if (!requester || !requester.organization_id) {
		throw new Error('User is not part of an organization');
	}
	const { organization_id } = requester;

	// Get all members
	return await sql`
        SELECT id, email, full_name, role, last_logged_in_at 
        FROM user_account 
        WHERE organization_id = ${organization_id}
        ORDER BY created_at DESC
    `;
};

export const updateMemberRole = async (requesterId: string, targetUserId: string, newRole: string) => {
	// Check permissions
	const requesters = await sql`SELECT organization_id, role FROM user_account WHERE id = ${requesterId}`;
	const requester = requesters[0];
	if (!requester || requester.role !== 'admin') {
		throw new Error('Unauthorized: Only admins can update members');
	}

	const targets = await sql`SELECT organization_id FROM user_account WHERE id = ${targetUserId}`;
	const target = targets[0];
	if (!target || target.organization_id !== requester.organization_id) {
		throw new Error('Target user is not in your organization');
	}

	// Prevent admin from demoting themselves
	if (requesterId === targetUserId && newRole !== 'admin') {
		throw new Error('You cannot demote yourself. Ask another admin to do it.');
	}

	const result = await sql`
        UPDATE user_account 
        SET role = ${newRole}
        WHERE id = ${targetUserId}
        RETURNING id, email, role
    `;
	return result[0];
};

export const removeMember = async (requesterId: string, targetUserId: string) => {
	// Check permissions
	const requesters = await sql`SELECT organization_id, role FROM user_account WHERE id = ${requesterId}`;
	const requester = requesters[0];
	if (!requester || requester.role !== 'admin') {
		throw new Error('Unauthorized: Only admins can remove members');
	}

	const targets = await sql`SELECT organization_id FROM user_account WHERE id = ${targetUserId}`;
	const target = targets[0];
	if (!target || target.organization_id !== requester.organization_id) {
		throw new Error('Target user is not in your organization');
	}

	if (requesterId === targetUserId) {
		throw new Error('You cannot remove yourself from the organization');
	}

	// Set org_id to null
	const result = await sql`
        UPDATE user_account 
        SET organization_id = NULL, role = 'interviewer'
        WHERE id = ${targetUserId}
        RETURNING id
    `;
	return result[0];
};

export const addMemberByEmail = async (requesterId: string, email: string, role: string = 'interviewer') => {
	const requesters = await sql`SELECT organization_id, role FROM user_account WHERE id = ${requesterId}`;
	const requester = requesters[0];
	if (!requester || !['admin', 'recruiter'].includes(requester.role)) {
		throw new Error('Unauthorized: Only admins and recruiters can add members');
	}

	// Check if user already exists in OUR db
	const targets = await sql`SELECT id, organization_id FROM user_account WHERE email = ${email}`;
	const target = targets[0];

	if (target) {
		// User exists in our system
		if (target.organization_id) {
			if (target.organization_id === requester.organization_id) {
				throw new Error('User is already a member of this organization');
			}
			throw new Error('User is already in another organization');
		}

		// Add existing user to org
		const result = await sql`
            UPDATE user_account 
            SET organization_id = ${requester.organization_id}, role = ${role}
            WHERE id = ${target.id}
            RETURNING *
        `;
		return result[0];
	} else {
		// User does not exist in our system. Invite via Supabase.

		if (!process.env.SUPABASE_PROJECT_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
			throw new Error('Server configuration error: Missing Supabase Admin keys');
		}

		const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

		// Use APP_URL env var for redirect (set to production URL)
		const frontendUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

		const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
			redirectTo: `${frontendUrl}auth/callback?next=/onboarding`,
		});

		if (error) {
			console.error('Supabase Invite Error:', error);
			throw new Error('Failed to invite user: ' + error.message);
		}

		if (!data.user) {
			throw new Error('Failed to invite user: No user data returned');
		}

		// Insert into our DB
		// We set their org_id and role immediately.
		const newUser = await sql`
            INSERT INTO user_account (id, email, organization_id, role)
            VALUES (${data.user.id}, ${email}, ${requester.organization_id}, ${role})
            RETURNING *
        `;
		return newUser[0];
	}
};

export const updateOrganization = async (
	requesterId: string,
	orgId: string,
	data: { name?: string; domain?: string; city?: string; country?: string }
) => {
	// Check permissions
	const requesters = await sql`SELECT organization_id, role FROM user_account WHERE id = ${requesterId}`;
	const requester = requesters[0];

	if (!requester || requester.role !== 'admin') {
		throw new Error('Unauthorized: Only admins can update organization details');
	}

	if (requester.organization_id !== orgId) {
		throw new Error('Unauthorized: You can only update your own organization');
	}

	const updatePayload: any = {};
	if (data.name !== undefined) updatePayload.name = data.name;
	if (data.domain !== undefined) updatePayload.domain = data.domain;
	if (data.city !== undefined) updatePayload.city = data.city;
	if (data.country !== undefined) updatePayload.country = data.country;

	if (Object.keys(updatePayload).length === 0) {
		const org = await sql`SELECT * FROM organization WHERE id = ${orgId}`;
		return org[0];
	}

	const result = await sql`
        UPDATE organization 
        SET ${sql(updatePayload)}
        WHERE id = ${orgId}
        RETURNING *
    `;
	return result[0];
};
