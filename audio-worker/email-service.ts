import nodemailer from 'nodemailer';

// Configure Nodemailer transporter for Brevo (Reusable)
const transporter = nodemailer.createTransport({
	host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
	port: parseInt(process.env.BREVO_SMTP_PORT || '587'),
	secure: false, // true for 465, false for other ports
	auth: {
		user: process.env.BREVO_SMTP_USER,
		pass: process.env.BREVO_SMTP_PASS,
	},
});

export const sendEmail = async (to: string, subject: string, html: string) => {
	if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_PASS) {
		console.log(`[EMAIL] Skipping email send to ${to} - SMTP credentials not set`);
		return;
	}

	try {
		console.log(`[EMAIL] Sending email to ${to} with subject: ${subject}`);
		const info = await transporter.sendMail({
			from: process.env.FROM_EMAIL || 'no-reply@evidenthire.in',
			to,
			subject,
			html,
		});
		console.log(`[EMAIL] Message sent: ${info.messageId}`);
		return info;
	} catch (error) {
		console.error(`[EMAIL] Failed to send email:`, error);
		// Don't throw, just log so worker doesn't crash? Or maybe throw depending on critical nature.
		// For report notification, logging is safer.
	}
};

export const sendReportReadyEmail = async (
	userEmail: string,
	candidateName: string,
	positionTitle: string,
	interviewId: string
) => {
	const appUrl = (process.env.APP_URL || 'https://app.evidenthire.in').replace(/\/$/, '');
	const reportLink = `${appUrl}/interview/${interviewId}?status=completed`;
	const dashboardLink = `${appUrl}/dashboard`;

	const subject = `Report Ready: ${candidateName} for ${positionTitle}`;
	const content = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Interview Report Ready</h2>
            <p>Hi,</p>
            <p>The AI-generated report for the interview with <strong>${candidateName}</strong> for the <strong>${positionTitle}</strong> position is now available.</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Candidate:</strong> ${candidateName}</p>
                <p style="margin: 5px 0;"><strong>Role:</strong> ${positionTitle}</p>
            </div>

            <div style="margin: 20px 0;">
                <a href="${reportLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 10px;">View Report</a>
                 <a href="${dashboardLink}" style="display: inline-block; background: #334155; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard</a>
            </div>
            
            <p>You can review the full transcript, competency analysis, and hire signal recommendation.</p>
            <p>Best,<br>EvidentHire Team</p>
        </div>
    `;

	return await sendEmail(userEmail, subject, content);
};

export const notifyReportGenerated = async (
	candidateEmail: string,
	candidateName: string,
	positionTitle: string,
	interviewId: string
) => {
	// Determine base URL
	const appUrl = (process.env.APP_URL || 'https://app.evidenthire.in').replace(/\/$/, '');
	// Usually the report is for the recruiter/user, not the candidate?
	// The previous request said: "inform the user that the report is generated".
	// "User" usually refers to the Recruiter/Hiring Manager in this context.

	// Wait, who is the "user"?
	// In `audio-worker/index.ts`, do we have the recruiter's email?
	// We have `candidateEmail` from `processAudioChunk` (from filename).
	// The `interview` table might have `user_id` -> user email.

	// I need to fetch the recruiter email from DB.
	// Let's implement this fetching logic in index.ts and pass the email here.

	// But wait, the function name `notifyReportGenerated` implies generic notification.
	// Let's make it generic for "User" (Recruiter).
};
