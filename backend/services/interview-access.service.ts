/**
 * Interview Access Control Service
 * Handles time-based access rules, waiting room logic, and interview lifecycle
 */

import { sql } from '../db';

// Configuration constants
export const ACCESS_CONFIG = {
	EARLY_JOIN_WINDOW_MINUTES: 30, // Can join up to 30 min before scheduled time
	LATE_JOIN_GRACE_MINUTES: 30, // Can join up to 30 min after scheduled time
	MIN_DURATION_FOR_COMPLETE_MINUTES: 10, // Minimum 10 min to be considered completed
	MAX_DURATION_MINUTES: 120, // Maximum 2 hours
	AUTO_EXPIRE_AFTER_MINUTES: 60, // Mark as no_show/expired after 1 hour past scheduled time
	WAITING_ROOM_TIMEOUT_MINUTES: 15, // Auto-reject from waiting room after 15 min
};

export interface AccessCheckResult {
	allowed: boolean;
	reason?: string;
	code?:
		| 'TOO_EARLY'
		| 'INTERVIEW_EXPIRED'
		| 'INTERVIEW_COMPLETED'
		| 'INTERVIEW_CANCELLED'
		| 'INTERVIEW_NO_SHOW'
		| 'WAITING_ROOM'
		| 'ALLOWED'
		| 'NOT_STARTED';
	waitingRoom?: boolean;
	interviewStatus?: string;
	scheduledStart?: Date;
	joinWindowStart?: Date;
	expiryTime?: Date;
	message?: string;
}

export interface Interview {
	id: string;
	scheduled_start: Date;
	scheduled_end: Date | null;
	status: string;
	first_join_at: Date | null;
	last_activity_at: Date | null;
	actual_end_at: Date | null;
	waiting_room_enabled: boolean;
	candidate_admitted: boolean;
	candidate_waiting_since: Date | null;
	max_duration_minutes: number;
}

/**
 * Check if a participant can access an interview based on time and status
 */
export async function checkInterviewAccess(
	interviewId: string,
	role: 'candidate' | 'interviewer' | 'observer'
): Promise<AccessCheckResult> {
	const interviews = await sql`
		SELECT 
			id, scheduled_start, scheduled_end, status,
			first_join_at, last_activity_at, actual_end_at,
			waiting_room_enabled, candidate_admitted, candidate_waiting_since,
			max_duration_minutes
		FROM interview 
		WHERE id = ${interviewId}
	`;

	if (!interviews[0]) {
		return {
			allowed: false,
			reason: 'Interview not found',
			code: 'INTERVIEW_EXPIRED',
		};
	}

	const interview = interviews[0] as Interview;
	const now = new Date();
	const scheduledStart = new Date(interview.scheduled_start);

	// Calculate time windows
	const joinWindowStart = new Date(scheduledStart.getTime() - ACCESS_CONFIG.EARLY_JOIN_WINDOW_MINUTES * 60 * 1000);
	const lateJoinDeadline = new Date(scheduledStart.getTime() + ACCESS_CONFIG.LATE_JOIN_GRACE_MINUTES * 60 * 1000);
	const expiryTime = new Date(scheduledStart.getTime() + ACCESS_CONFIG.AUTO_EXPIRE_AFTER_MINUTES * 60 * 1000);

	// Check interview status first
	switch (interview.status) {
		case 'completed':
			return {
				allowed: false,
				reason: 'This interview has already ended.',
				code: 'INTERVIEW_COMPLETED',
				interviewStatus: interview.status,
				scheduledStart,
			};

		case 'cancelled':
			return {
				allowed: false,
				reason: 'This interview has been cancelled.',
				code: 'INTERVIEW_CANCELLED',
				interviewStatus: interview.status,
				scheduledStart,
			};

		case 'no_show':
		case 'expired':
			return {
				allowed: false,
				reason: 'This interview has expired. No participants joined within the allowed time window.',
				code: 'INTERVIEW_EXPIRED',
				interviewStatus: interview.status,
				scheduledStart,
			};
	}

	// Time-based checks for scheduled/in_progress interviews
	if (now < joinWindowStart) {
		// Too early
		const minutesUntilOpen = Math.ceil((joinWindowStart.getTime() - now.getTime()) / 60000);
		return {
			allowed: false,
			reason: `Interview lobby opens ${ACCESS_CONFIG.EARLY_JOIN_WINDOW_MINUTES} minutes before the scheduled time. Please return in ${minutesUntilOpen} minutes.`,
			code: 'TOO_EARLY',
			interviewStatus: interview.status,
			scheduledStart,
			joinWindowStart,
		};
	}

	// Check if past expiry time (never started)
	if (interview.status === 'scheduled' && !interview.first_join_at && now > expiryTime) {
		// Auto-mark as expired
		await sql`
			UPDATE interview 
			SET status = 'expired', ended_reason = 'no_show'
			WHERE id = ${interviewId} AND status = 'scheduled'
		`;

		return {
			allowed: false,
			reason: 'This interview has expired. No participants joined within the allowed time window.',
			code: 'INTERVIEW_EXPIRED',
			interviewStatus: 'expired',
			scheduledStart,
			expiryTime,
		};
	}

	// Check late join (past grace period, but someone joined before)
	if (now > lateJoinDeadline && !interview.first_join_at) {
		// Still in grace period after scheduled time
		const minutesPastSchedule = Math.ceil((now.getTime() - scheduledStart.getTime()) / 60000);
		// Allow with warning
		console.log(`Late join attempt for interview ${interviewId}: ${minutesPastSchedule} minutes past schedule`);
	}

	// Interview is in progress - check waiting room for candidates
	if (role === 'candidate' && interview.waiting_room_enabled && !interview.candidate_admitted) {
		// Put candidate in waiting room
		await sql`
			UPDATE interview 
			SET candidate_waiting_since = COALESCE(candidate_waiting_since, NOW())
			WHERE id = ${interviewId}
		`;

		return {
			allowed: true,
			waitingRoom: true,
			reason: 'Please wait for the interviewer to admit you to the interview.',
			code: 'WAITING_ROOM',
			interviewStatus: interview.status,
			scheduledStart,
			message: 'You are in the waiting room. The interviewer will admit you shortly.',
		};
	}

	// Interviewers and admitted candidates can join
	return {
		allowed: true,
		code: 'ALLOWED',
		interviewStatus: interview.status,
		scheduledStart,
		joinWindowStart,
		expiryTime,
	};
}

/**
 * Record that a participant has joined the interview
 */
export async function recordParticipantJoin(
	interviewId: string,
	role: 'candidate' | 'interviewer' | 'observer'
): Promise<void> {
	const now = new Date();

	// Update first_join_at if not set, and update last_activity_at
	await sql`
		UPDATE interview 
		SET 
			first_join_at = COALESCE(first_join_at, ${now}),
			last_activity_at = ${now},
			status = CASE 
				WHEN status = 'scheduled' THEN 'in_progress' 
				ELSE status 
			END
		WHERE id = ${interviewId}
	`;

	console.log(`Participant (${role}) joined interview ${interviewId}`);
}

/**
 * Admit a candidate from the waiting room (interviewer action)
 */
export async function admitCandidate(
	interviewId: string,
	interviewerUserId: string
): Promise<{ success: boolean; message: string }> {
	// Verify the user is an interviewer for this interview
	const interviewers = await sql`
		SELECT user_id FROM interview_interviewer 
		WHERE interview_id = ${interviewId} AND user_id = ${interviewerUserId}
	`;

	if (!interviewers[0]) {
		return { success: false, message: 'You are not authorized to admit participants to this interview.' };
	}

	// Admit the candidate
	const result = await sql`
		UPDATE interview 
		SET candidate_admitted = true, last_activity_at = NOW()
		WHERE id = ${interviewId}
		RETURNING *
	`;

	if (result[0]) {
		console.log(`Candidate admitted to interview ${interviewId} by interviewer ${interviewerUserId}`);
		return { success: true, message: 'Candidate has been admitted to the interview.' };
	}

	return { success: false, message: 'Failed to admit candidate.' };
}

/**
 * Check if candidate is in waiting room
 */
export async function getCandidateWaitingStatus(interviewId: string): Promise<{
	isWaiting: boolean;
	waitingSince: Date | null;
	isAdmitted: boolean;
}> {
	const result = await sql`
		SELECT candidate_waiting_since, candidate_admitted, waiting_room_enabled
		FROM interview 
		WHERE id = ${interviewId}
	`;

	if (!result[0]) {
		return { isWaiting: false, waitingSince: null, isAdmitted: false };
	}

	const interview = result[0] as any;
	return {
		isWaiting: interview.waiting_room_enabled && interview.candidate_waiting_since && !interview.candidate_admitted,
		waitingSince: interview.candidate_waiting_since,
		isAdmitted: interview.candidate_admitted,
	};
}

/**
 * End an interview (interviewer action or auto-timeout)
 */
export async function endInterview(
	interviewId: string,
	reason: 'normal' | 'timeout' | 'interviewer_ended' | 'technical_issue',
	userId?: string
): Promise<{ success: boolean; message: string; status?: string }> {
	// If userId provided, verify they're an interviewer
	if (userId) {
		const interviewers = await sql`
			SELECT user_id FROM interview_interviewer 
			WHERE interview_id = ${interviewId} AND user_id = ${userId}
		`;

		if (!interviewers[0]) {
			return { success: false, message: 'Only interviewers can end the interview.' };
		}
	}

	// Get interview details to calculate duration
	const interviews = await sql`
		SELECT first_join_at, status FROM interview WHERE id = ${interviewId}
	`;

	if (!interviews[0]) {
		return { success: false, message: 'Interview not found.' };
	}

	const interview = interviews[0] as any;

	if (interview.status === 'completed' || interview.status === 'cancelled') {
		return { success: false, message: 'Interview has already ended.' };
	}

	const now = new Date();
	let totalDurationMs = 0;
	let finalStatus = 'completed';

	if (interview.first_join_at) {
		totalDurationMs = now.getTime() - new Date(interview.first_join_at).getTime();
		const durationMinutes = totalDurationMs / 60000;

		// Check minimum duration for "completed" status
		if (durationMinutes < ACCESS_CONFIG.MIN_DURATION_FOR_COMPLETE_MINUTES) {
			finalStatus = 'cancelled'; // Short interviews are treated as cancelled/aborted
			console.log(`Interview ${interviewId} was too short (${durationMinutes.toFixed(1)} min), marking as cancelled`);
		}
	} else {
		// No one ever joined
		finalStatus = 'no_show';
	}

	// Update interview
	const result = await sql`
		UPDATE interview 
		SET 
			status = ${finalStatus},
			actual_end_at = ${now},
			ended_reason = ${reason},
			total_duration_ms = ${totalDurationMs || null}
		WHERE id = ${interviewId}
		RETURNING *
	`;

	if (result[0]) {
		console.log(`Interview ${interviewId} ended with status ${finalStatus}, reason: ${reason}`);
		return { success: true, message: `Interview ended successfully.`, status: finalStatus };
	}

	return { success: false, message: 'Failed to end interview.' };
}

/**
 * Check and auto-expire interviews that have passed their expiry window
 * This should be called periodically (e.g., via a cron job)
 */
export async function checkAndExpireInterviews(): Promise<{ expiredCount: number }> {
	const expiryThreshold = new Date(Date.now() - ACCESS_CONFIG.AUTO_EXPIRE_AFTER_MINUTES * 60 * 1000);

	const result = await sql`
		UPDATE interview 
		SET 
			status = 'expired',
			ended_reason = 'no_show',
			actual_end_at = NOW()
		WHERE 
			status = 'scheduled' 
			AND first_join_at IS NULL 
			AND scheduled_start < ${expiryThreshold}
		RETURNING id
	`;

	const expiredCount = result.length;
	if (expiredCount > 0) {
		console.log(`Auto-expired ${expiredCount} interviews that passed their join window`);
	}

	return { expiredCount };
}

/**
 * Check and timeout interviews that have exceeded max duration
 */
export async function checkAndTimeoutInterviews(): Promise<{ timedOutCount: number }> {
	// Find in_progress interviews that have exceeded their max duration
	const result = await sql`
		UPDATE interview 
		SET 
			status = 'completed',
			ended_reason = 'timeout',
			actual_end_at = NOW(),
			total_duration_ms = EXTRACT(EPOCH FROM (NOW() - first_join_at)) * 1000
		WHERE 
			status = 'in_progress' 
			AND first_join_at IS NOT NULL 
			AND first_join_at < NOW() - (max_duration_minutes * interval '1 minute')
		RETURNING id
	`;

	const timedOutCount = result.length;
	if (timedOutCount > 0) {
		console.log(`Auto-timed-out ${timedOutCount} interviews that exceeded max duration`);
	}

	return { timedOutCount };
}

/**
 * Get interview status summary for display
 */
export async function getInterviewStatusSummary(interviewId: string): Promise<{
	status: string;
	canJoin: boolean;
	message: string;
	waitingRoom?: {
		candidateWaiting: boolean;
		waitingSince: Date | null;
	};
	timing?: {
		scheduledStart: Date;
		joinWindowStart: Date;
		expiryTime: Date;
		durationMs: number | null;
	};
} | null> {
	const interviews = await sql`
		SELECT 
			id, scheduled_start, status, first_join_at, 
			candidate_waiting_since, candidate_admitted, waiting_room_enabled,
			total_duration_ms, max_duration_minutes
		FROM interview 
		WHERE id = ${interviewId}
	`;

	if (!interviews[0]) {
		return null;
	}

	const interview = interviews[0] as any;
	const scheduledStart = new Date(interview.scheduled_start);
	const joinWindowStart = new Date(scheduledStart.getTime() - ACCESS_CONFIG.EARLY_JOIN_WINDOW_MINUTES * 60 * 1000);
	const expiryTime = new Date(scheduledStart.getTime() + ACCESS_CONFIG.AUTO_EXPIRE_AFTER_MINUTES * 60 * 1000);

	let canJoin = false;
	let message = '';

	const now = new Date();

	switch (interview.status) {
		case 'scheduled':
			if (now < joinWindowStart) {
				message = `Interview opens ${ACCESS_CONFIG.EARLY_JOIN_WINDOW_MINUTES} minutes before scheduled time.`;
			} else if (now > expiryTime) {
				message = 'Interview has expired.';
			} else {
				canJoin = true;
				message = 'Ready to join.';
			}
			break;
		case 'in_progress':
			canJoin = true;
			message = 'Interview is in progress.';
			break;
		case 'completed':
			message = 'Interview has ended.';
			break;
		case 'cancelled':
			message = 'Interview was cancelled.';
			break;
		case 'no_show':
		case 'expired':
			message = 'Interview expired - no participants joined.';
			break;
	}

	return {
		status: interview.status,
		canJoin,
		message,
		waitingRoom: interview.waiting_room_enabled
			? {
					candidateWaiting: !interview.candidate_admitted && !!interview.candidate_waiting_since,
					waitingSince: interview.candidate_waiting_since,
			  }
			: undefined,
		timing: {
			scheduledStart,
			joinWindowStart,
			expiryTime,
			durationMs: interview.total_duration_ms,
		},
	};
}
