import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
const FROM_EMAIL = process.env.FROM_EMAIL || 'EvidentHire <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Send a generic email
 */
export const sendEmail = async (to: string | string[], subject: string, html: string) => {
	if (!process.env.RESEND_API_KEY) {
		console.log('Skipping email send - RESEND_API_KEY not set');
		console.log('To:', to);
		console.log('Subject:', subject);
		return { id: 'mock_id' };
	}

	try {
		const data = await resend.emails.send({
			from: FROM_EMAIL,
			to: Array.isArray(to) ? to : [to],
			subject,
			html,
		});
		return data;
	} catch (error) {
		console.error('Failed to send email:', error);
		throw error;
	}
};

/**
 * Notify candidate and interviewers about a scheduled interview
 */
export const notifyInterviewScheduled = async (data: {
	interviewId: string;
	candidateEmail: string;
	candidateName: string;
	positionTitle: string;
	scheduledStart: Date;
	interviewerEmails: string[];
}) => {
	const dateStr = data.scheduledStart.toLocaleDateString();
	const timeStr = data.scheduledStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	const joinLink = `${APP_URL}/interview/${data.interviewId}`;

	// 1. Email to Candidate
	const candidatePromise = sendEmail(
		data.candidateEmail,
		`Interview Scheduled: ${data.positionTitle}`,
		`
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Interview Scheduled</h2>
            <p>Hi ${data.candidateName},</p>
            <p>We are excited to move forward with your application for the <strong>${data.positionTitle}</strong> position.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Date:</strong> ${dateStr}</p>
                <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${timeStr}</p>
            </div>
            <p>You can join the interview directly through our lobby below:</p>
            <a href="${joinLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px 0;">Join Interview Lobby</a>
            <p>Please make sure to check your audio and video settings before joining.</p>
            <p>Best regards,<br>The Recruitment Team</p>
        </div>
        `
	);

	// 2. Email to Interviewers
	const interviewerPromise =
		data.interviewerEmails.length > 0
			? sendEmail(
					data.interviewerEmails,
					`Upcoming Interview: ${data.candidateName} for ${data.positionTitle}`,
					`
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #f97316;">New Interview Scheduled</h2>
                <p>Hello,</p>
                <p>You have been assigned as an interviewer for <strong>${data.candidateName}</strong>.</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Position:</strong> ${data.positionTitle}</p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${timeStr}</p>
                </div>
                <div style="margin: 20px 0;">
                    <a href="${joinLink}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">Join Interview</a>
                    <a href="${APP_URL}/dashboard" style="display: inline-block; background: #334155; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Dashboard</a>
                </div>
                <p>Please review the candidate's profile and the interview guidelines in the dashboard.</p>
            </div>
            `
			  )
			: Promise.resolve();

	return await Promise.all([candidatePromise, interviewerPromise]);
};

/**
 * Notify about interview cancellation
 */
export const notifyInterviewCancelled = async (data: {
	candidateEmail: string;
	candidateName: string;
	positionTitle: string;
	scheduledStart: Date;
	interviewerEmails: string[];
}) => {
	const dateStr = data.scheduledStart.toLocaleDateString();

	const subject = `Interview Cancelled: ${data.positionTitle}`;
	const content = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #ef4444;">Interview Cancelled</h2>
            <p>Hi,</p>
            <p>The interview scheduled for <strong>${data.positionTitle}</strong> on <strong>${dateStr}</strong> has been cancelled.</p>
            <p>If this was a mistake or you have questions, please reach out to the recruitment team.</p>
        </div>
    `;

	return await Promise.all([
		sendEmail(data.candidateEmail, subject, content),
		data.interviewerEmails.length > 0 ? sendEmail(data.interviewerEmails, subject, content) : Promise.resolve(),
	]);
};
