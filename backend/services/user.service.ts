import { sql } from '../db';

export interface User {
	id: string;
	email: string;
}

export const createUser = async (user: User) => {
	try {
		// Ensure user exists in user_account table.
		// Role defaults to 'interviewer' if not specified, but we should probably handle it better.
		// For now, on create (signup), we just need ID and Email.
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
			// 1. Create or Find Organization
			// Simplification: Check domain match or create new.
			// Ideally we might want to prevent duplicate domains?
			// Let's create new for now or return existing if domain matches exactly.

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
			// Note: DB expects 'full_name' but frontend sends 'fullName'.
			const updatedUser = await tx`
				UPDATE user_account
				SET 
					full_name = ${data.fullName},
					organization_id = ${orgId},
					date_of_birth = ${data.dob},
					gender = ${data.gender},
					city = ${data.city},
					country = ${data.country},
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
