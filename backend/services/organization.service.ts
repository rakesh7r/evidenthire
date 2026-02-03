import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sql } from '../db';

// Helper to get Supabase admin client
function getSupabaseAdmin(): SupabaseClient {
	if (!process.env.SUPABASE_PROJECT_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error('Server configuration error: Missing Supabase Admin keys');
	}
	return createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

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

/**
 * Remove a member from the organization.
 * Options:
 * - deleteCompletely: If true, delete from both DB and Supabase. If false, just remove from org.
 */
export const removeMember = async (
	requesterId: string,
	targetUserId: string,
	options: { deleteCompletely?: boolean } = {}
) => {
	const { deleteCompletely = false } = options;

	// Check permissions
	const requesters = await sql`SELECT organization_id, role FROM user_account WHERE id = ${requesterId}`;
	const requester = requesters[0];
	if (!requester || requester.role !== 'admin') {
		throw new Error('Unauthorized: Only admins can remove members');
	}

	const targets = await sql`SELECT id, email, organization_id, full_name FROM user_account WHERE id = ${targetUserId}`;
	const target = targets[0];
	if (!target || target.organization_id !== requester.organization_id) {
		throw new Error('Target user is not in your organization');
	}

	if (requesterId === targetUserId) {
		throw new Error('You cannot remove yourself from the organization');
	}

	if (deleteCompletely) {
		// Delete from both DB and Supabase
		const supabase = getSupabaseAdmin();

		// First, clean up related records in DB
		await sql`DELETE FROM interview_participant WHERE user_id = ${targetUserId}`;

		// Delete from our DB
		await sql`DELETE FROM user_account WHERE id = ${targetUserId}`;

		// Delete from Supabase Auth
		const { error: supabaseError } = await supabase.auth.admin.deleteUser(targetUserId);
		if (supabaseError) {
			console.error('Failed to delete user from Supabase:', supabaseError);
			// User is already deleted from DB, log for manual cleanup
			console.error(`MANUAL CLEANUP NEEDED: Supabase user ${targetUserId} (${target.email}) was not deleted`);
		}

		console.log(`User ${target.email} completely deleted from DB and Supabase`);
		return { id: targetUserId, deleted: true };
	} else {
		// Just remove from organization (soft remove)
		const result = await sql`
            UPDATE user_account 
            SET organization_id = NULL, role = 'interviewer'
            WHERE id = ${targetUserId}
            RETURNING id
        `;
		return result[0];
	}
};

/**
 * Add a member to the organization by email.
 * - If user exists in DB without org, assign them to this org.
 * - If user doesn't exist, invite via Supabase and create DB record atomically.
 */
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
		const supabase = getSupabaseAdmin();

		// Use APP_URL env var for redirect (set to production URL)
		const frontendUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

		// Step 1: Create user in Supabase
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

		const supabaseUserId = data.user.id;

		// Step 2: Insert into our DB - wrapped in try/catch to rollback Supabase on failure
		try {
			const newUser = await sql`
                INSERT INTO user_account (id, email, organization_id, role)
                VALUES (${supabaseUserId}, ${email}, ${requester.organization_id}, ${role})
                RETURNING *
            `;
			console.log(`User ${email} invited and added to DB successfully`);
			return newUser[0];
		} catch (dbError) {
			// DB insert failed - rollback Supabase user
			console.error('DB insert failed, rolling back Supabase user:', dbError);

			try {
				await supabase.auth.admin.deleteUser(supabaseUserId);
				console.log(`Rolled back Supabase user ${supabaseUserId}`);
			} catch (rollbackError) {
				console.error(`CRITICAL: Failed to rollback Supabase user ${supabaseUserId}:`, rollbackError);
			}

			throw new Error('Failed to add user to database. Please try again.');
		}
	}
};

/**
 * Delete a user completely from both DB and Supabase.
 * This is for admin cleanup purposes.
 */
export const deleteUserCompletely = async (userId: string) => {
	const supabase = getSupabaseAdmin();

	// Get user info first
	const users = await sql`SELECT id, email FROM user_account WHERE id = ${userId}`;
	const user = users[0];

	if (!user) {
		// Check if exists in Supabase only
		const { data: supabaseUser } = await supabase.auth.admin.getUserById(userId);
		if (supabaseUser?.user) {
			// Delete from Supabase
			await supabase.auth.admin.deleteUser(userId);
			console.log(`Deleted orphaned Supabase user ${userId}`);
			return { deleted: true, source: 'supabase_only' };
		}
		throw new Error('User not found');
	}

	// Clean up related records
	await sql`DELETE FROM interview_participant WHERE user_id = ${userId}`;

	// Delete from DB
	await sql`DELETE FROM user_account WHERE id = ${userId}`;

	// Delete from Supabase
	const { error } = await supabase.auth.admin.deleteUser(userId);
	if (error) {
		console.error(`Warning: Failed to delete from Supabase: ${error.message}`);
	}

	console.log(`User ${user.email} completely deleted`);
	return { deleted: true, email: user.email };
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
