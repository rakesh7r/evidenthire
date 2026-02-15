import { sql } from '../db';
import { createClient } from '@supabase/supabase-js';

export interface User {
	id: string;
	email: string;
}

// Helper to get Supabase admin client
function getSupabaseAdmin() {
	if (!process.env.SUPABASE_PROJECT_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return null;
	}
	return createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const createUser = async (user: User) => {
	try {
		// Check if email already exists with a DIFFERENT ID (user was pre-invited)
		const existing = await sql`
			SELECT id, organization_id, role FROM user_account WHERE email = ${user.email}
		`;

		if (existing[0] && existing[0].id !== user.id) {
			// Email exists with different ID - this means user was invited before signing up.
			// Update the existing record's ID to match the new Supabase auth ID.
			// This links the pre-created account to the actual authenticated user.
			const oldId = existing[0].id;

			console.log(`Migrating user ${user.email}: old ID ${oldId} -> new ID ${user.id}`);

			const result = await sql.begin(async (tx: any) => {
				// Update related tables first (foreign key references)
				await tx`UPDATE interview_participant SET user_id = ${user.id} WHERE user_id = ${oldId}`;

				// Now update the user_account ID
				const updated = await tx`
					UPDATE user_account 
					SET id = ${user.id}, last_logged_in_at = NOW()
					WHERE email = ${user.email}
					RETURNING *
				`;
				return updated[0];
			});

			// Clean up old Supabase user (if different from new) to avoid orphaned accounts
			const supabase = getSupabaseAdmin();
			if (supabase && oldId !== user.id) {
				try {
					await supabase.auth.admin.deleteUser(oldId);
					console.log(`Cleaned up old Supabase user ${oldId}`);
				} catch (cleanupErr) {
					// Not critical - the old ID might not exist in Supabase
					console.log(`Could not cleanup old Supabase user ${oldId} (may not exist)`);
				}
			}

			return result;
		}

		// Normal upsert: either new user or same ID already exists
		const result = await sql`
			INSERT INTO user_account (id, email, role)
			VALUES (${user.id}, ${user.email}, 'interviewer')
			ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, last_logged_in_at = NOW()
			RETURNING *
		`;
		return result[0];
	} catch (err) {
		console.error('Database error details:', err);
		throw new Error('Failed to create user record');
	}
};

export interface OnboardingData {
	fullName: string;
	organizationName: string;
	organizationDomain: string;
	dob: string;
	gender: string;
	city: string;
	country: string;
}

export const updateUserOnboarding = async (userId: string, data: OnboardingData) => {
	try {
		// Use a transaction
		const result = await sql.begin(async (tx: any) => {
			// First, check if user already has an organization assigned (was invited)
			const existingUser = await tx`
				SELECT organization_id, role FROM user_account WHERE id = ${userId}
			`;

			const userRecord = existingUser[0];

			// If user was invited to an org, just update personal details and keep org/role
			if (userRecord && userRecord.organization_id) {
				const updatedUser = await tx`
					UPDATE user_account
					SET 
						full_name = ${data.fullName},
						date_of_birth = ${data.dob || null},
						gender = ${data.gender || null},
						city = ${data.city || null},
						country = ${data.country || null}
					WHERE id = ${userId}
					RETURNING *
				`;
				return updatedUser[0];
			}

			// User was NOT invited - normal onboarding flow
			// 1. Create or Find Organization by domain
			let orgId: string;

			const existingOrgs = await tx`
                SELECT id FROM organization WHERE domain = ${data.organizationDomain} LIMIT 1
            `;

			if (existingOrgs.length > 0) {
				orgId = existingOrgs[0].id;
			} else {
				const newOrg = await tx`
                    INSERT INTO organization (name, domain)
                    VALUES (${data.organizationName}, ${data.organizationDomain})
                    RETURNING id
                `;
				orgId = newOrg[0].id;
			}

			// Determine role: Admin if first user in org, otherwise Interviewer
			const usersInOrg = await tx`
                SELECT 1 FROM user_account WHERE organization_id = ${orgId} LIMIT 1
            `;
			const role = usersInOrg.length === 0 ? 'admin' : 'interviewer';

			// 2. Update User Account
			const updatedUser = await tx`
				UPDATE user_account
				SET 
					full_name = ${data.fullName},
					organization_id = ${orgId},
					date_of_birth = ${data.dob || null},
					gender = ${data.gender || null},
					city = ${data.city || null},
					country = ${data.country || null},
                    role = ${role}
				WHERE id = ${userId}
				RETURNING *
			`;
			return updatedUser[0];
		});
		return result;
	} catch (err) {
		console.error('Onboarding error:', err);
		throw new Error('Failed to complete onboarding');
	}
};

export const getUserByEmail = async (email: string) => {
	const users = await sql`SELECT * FROM user_account WHERE email = ${email}`;
	return users[0];
};

export const getUserById = async (id: string) => {
	const users = await sql`
        SELECT 
            u.*, 
            o.name as organization_name, 
            o.domain as organization_domain,
            o.city as organization_city,
            o.country as organization_country
        FROM user_account u
        LEFT JOIN organization o ON u.organization_id = o.id
        WHERE u.id = ${id}
    `;
	return users[0];
};

export interface UserProfileUpdate {
	fullName?: string;
	city?: string;
	country?: string;
	gender?: string;
	dob?: string;
}

export const updateUserProfile = async (userId: string, data: UserProfileUpdate) => {
	const updatePayload: any = {};
	if (data.fullName !== undefined) updatePayload.full_name = data.fullName;
	if (data.city !== undefined) updatePayload.city = data.city;
	if (data.country !== undefined) updatePayload.country = data.country;
	if (data.gender !== undefined) updatePayload.gender = data.gender;
	if (data.dob !== undefined) updatePayload.date_of_birth = data.dob;

	if (Object.keys(updatePayload).length === 0) {
		return getUserById(userId);
	}

	const result = await sql`
        UPDATE user_account
        SET ${sql(updatePayload)}
        WHERE id = ${userId}
        RETURNING *
    `;
	return getUserById(userId);
};

export const getUsersByOrg = async (userId: string) => {
	const user = await sql`SELECT organization_id FROM user_account WHERE id = ${userId}`;
	const organization_id = user[0]?.organization_id;

	if (!organization_id) {
		return [];
	}

	return await sql`
        SELECT id, email, full_name, role 
        FROM user_account 
        WHERE organization_id = ${organization_id}
        ORDER BY full_name ASC
    `;
};
