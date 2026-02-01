import nodemailer from 'nodemailer';
import { createEvent, type EventAttributes } from 'ics';

const FROM_EMAIL = process.env.FROM_EMAIL || 'EvidentHire <no-reply@evidenthire.in>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Configure Nodemailer transporter for Brevo
const transporter = nodemailer.createTransport({
	host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
	port: parseInt(process.env.BREVO_SMTP_PORT || '587'),
	secure: false, // true for 465, false for other ports
	auth: {
		user: process.env.BREVO_SMTP_USER, // e.g., <domain>@smtp-brevo.com
		pass: process.env.BREVO_SMTP_PASS,
	},
});

/**
 * Send a generic email
 */
export const sendEmail = async (to: string | string[], subject: string, html: string, attachments?: any[]) => {
	if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_PASS) {
		console.log('Skipping email send - SMTP credentials not set');
		console.log('To:', to);
		console.log('Subject:', subject);
		return { messageId: 'mock_id' };
	}

	try {
		const toAddress = Array.isArray(to) ? to.join(', ') : to;
		const info = await transporter.sendMail({
			from: FROM_EMAIL,
			to: toAddress,
			subject,
			html,
			attachments,
		});
		console.log('Message sent: %s', info.messageId);
		return info;
	} catch (error) {
		console.error('Failed to send email:', error);
		throw error;
	}
};

const generateIcsEvent = async (event: EventAttributes): Promise<string> => {
	return new Promise((resolve, reject) => {
		createEvent(event, (error, value) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(value);
		});
	});
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
	candidateAccessKey?: string | null;
}) => {
	const dateStr = data.scheduledStart.toLocaleDateString();
	const timeStr = data.scheduledStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	// Base link
	const baseLink = `${APP_URL}/interview/${data.interviewId}`;
	// Candidate specific link with auth params
	const candidateJoinLink = data.candidateAccessKey
		? `${baseLink}?email=${encodeURIComponent(data.candidateEmail)}&candidate_access_key=${
				data.candidateAccessKey
		  }&interviewId=${data.interviewId}`
		: baseLink;

	// Generate ICS for Candidate
	let candidateIcsAttachment: any[] = [];
	try {
		const startArr: [number, number, number, number, number] = [
			data.scheduledStart.getFullYear(),
			data.scheduledStart.getMonth() + 1,
			data.scheduledStart.getDate(),
			data.scheduledStart.getHours(),
			data.scheduledStart.getMinutes(),
		];

		const eventData: EventAttributes = {
			start: startArr,
			duration: { hours: 1 },
			title: `Interview: ${data.positionTitle}`,
			description: `Interview for ${data.positionTitle} position.\n\nJoin Link: ${candidateJoinLink}`,
			location: 'EvidentHire Video Room',
			url: candidateJoinLink,
			organizer: { name: 'EvidentHire', email: 'no-reply@evidenthire.in' },
			attendees: [{ name: data.candidateName, email: data.candidateEmail, rsvp: true }],
		};

		const icsContent = await generateIcsEvent(eventData);
		candidateIcsAttachment = [
			{
				filename: 'interview.ics',
				content: icsContent,
				contentType: 'text/calendar',
			},
		];
	} catch (e) {
		console.error('Failed to generate ICS for candidate', e);
	}

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
            <a href="${candidateJoinLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px 0;">Join Interview Lobby</a>
            <p>Please make sure to check your audio and video settings before joining.</p>
            <p>Best regards,<br>The Recruitment Team</p>
        </div>
        `,
		candidateIcsAttachment
	);

	// Generate ICS for Interviewers
	let interviewerIcsAttachment: any[] = [];
	try {
		const startArr: [number, number, number, number, number] = [
			data.scheduledStart.getFullYear(),
			data.scheduledStart.getMonth() + 1,
			data.scheduledStart.getDate(),
			data.scheduledStart.getHours(),
			data.scheduledStart.getMinutes(),
		];

		const eventData: EventAttributes = {
			start: startArr,
			duration: { hours: 1 },
			title: `Interview: ${data.candidateName} (${data.positionTitle})`,
			description: `Interview with ${data.candidateName} for ${data.positionTitle}.\n\nJoin Link: ${baseLink}`,
			location: 'EvidentHire Video Room',
			url: baseLink,
			organizer: { name: 'EvidentHire', email: 'no-reply@evidenthire.in' },
		};

		const icsContent = await generateIcsEvent(eventData);
		interviewerIcsAttachment = [
			{
				filename: 'interview.ics',
				content: icsContent,
				contentType: 'text/calendar',
			},
		];
	} catch (e) {
		console.error('Failed to generate ICS for interviewer', e);
	}

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
                    <a href="${baseLink}?isInterviewer=true" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">Join Interview</a>
                    <a href="${APP_URL}/dashboard" style="display: inline-block; background: #334155; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Dashboard</a>
                </div>
                <p>Please review the candidate's profile and the interview guidelines in the dashboard.</p>
            </div>
            `,
					interviewerIcsAttachment
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

/**
 * Notify about interview details update
 */
export const notifyInterviewUpdated = async (data: {
	interviewId: string;
	candidateEmail: string;
	candidateName: string;
	positionTitle: string;
	scheduledStart: Date;
	interviewerEmails: string[];
	candidateAccessKey?: string | null;
}) => {
	// Reuse logic from scheduled but change title/subject
	const dateStr = data.scheduledStart.toLocaleDateString();
	const timeStr = data.scheduledStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	const baseLink = `${APP_URL}/interview/${data.interviewId}`;
	const candidateJoinLink = data.candidateAccessKey
		? `${baseLink}?email=${encodeURIComponent(data.candidateEmail)}&candidate_access_key=${
				data.candidateAccessKey
		  }&interviewId=${data.interviewId}`
		: baseLink;

	// Generate ICS for Candidate
	let candidateIcsAttachment: any[] = [];
	try {
		const startArr: [number, number, number, number, number] = [
			data.scheduledStart.getFullYear(),
			data.scheduledStart.getMonth() + 1,
			data.scheduledStart.getDate(),
			data.scheduledStart.getHours(),
			data.scheduledStart.getMinutes(),
		];

		const eventData: EventAttributes = {
			start: startArr,
			duration: { hours: 1 },
			title: `UPDATED: Interview: ${data.positionTitle}`,
			description: `UPDATED Interview for ${data.positionTitle} position.\n\nJoin Link: ${candidateJoinLink}`,
			location: 'EvidentHire Video Room',
			url: candidateJoinLink,
			organizer: { name: 'EvidentHire', email: 'no-reply@evidenthire.in' },
			attendees: [{ name: data.candidateName, email: data.candidateEmail, rsvp: true }],
		};

		const icsContent = await generateIcsEvent(eventData);
		candidateIcsAttachment = [
			{
				filename: 'interview_updated.ics',
				content: icsContent,
				contentType: 'text/calendar',
			},
		];
	} catch (e) {
		console.error('Failed to generate ICS for candidate update', e);
	}

	// 1. Email to Candidate
	const candidatePromise = sendEmail(
		data.candidateEmail,
		`Interview Updated: ${data.positionTitle}`,
		`
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Interview Details Updated</h2>
            <p>Hi ${data.candidateName},</p>
            <p>The details for your <strong>${data.positionTitle}</strong> interview have been updated.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>New Date:</strong> ${dateStr}</p>
                <p style="margin: 5px 0 0 0;"><strong>New Time:</strong> ${timeStr}</p>
            </div>
            <p>You can join using the same link:</p>
            <a href="${candidateJoinLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px 0;">Join Interview Lobby</a>
        </div>
        `,
		candidateIcsAttachment
	);

	// Generate ICS for Interviewers
	let interviewerIcsAttachment: any[] = [];
	try {
		const startArr: [number, number, number, number, number] = [
			data.scheduledStart.getFullYear(),
			data.scheduledStart.getMonth() + 1,
			data.scheduledStart.getDate(),
			data.scheduledStart.getHours(),
			data.scheduledStart.getMinutes(),
		];

		const eventData: EventAttributes = {
			start: startArr,
			duration: { hours: 1 },
			title: `UPDATED: Interview: ${data.candidateName} (${data.positionTitle})`,
			description: `UPDATED Interview with ${data.candidateName} for ${data.positionTitle}.\n\nJoin Link: ${baseLink}`,
			location: 'EvidentHire Video Room',
			url: baseLink,
			organizer: { name: 'EvidentHire', email: 'no-reply@evidenthire.in' },
		};

		const icsContent = await generateIcsEvent(eventData);
		interviewerIcsAttachment = [
			{
				filename: 'interview_updated.ics',
				content: icsContent,
				contentType: 'text/calendar',
			},
		];
	} catch (e) {
		console.error('Failed to generate ICS for interviewer update', e);
	}

	// 2. Email to Interviewers
	const interviewerPromise =
		data.interviewerEmails.length > 0
			? sendEmail(
					data.interviewerEmails,
					`Interview Updated: ${data.candidateName}`,
					`
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #f97316;">Interview Details Updated</h2>
                <p>Hello,</p>
                <p>The interview for <strong>${data.candidateName}</strong> has been updated.</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Position:</strong> ${data.positionTitle}</p>
                    <p style="margin: 5px 0;"><strong>New Date:</strong> ${dateStr}</p>
                    <p style="margin: 5px 0 0 0;"><strong>New Time:</strong> ${timeStr}</p>
                </div>
                <div style="margin: 20px 0;">
                    <a href="${baseLink}?isInterviewer=true" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">Join Interview</a>
                </div>
            </div>
            `,
					interviewerIcsAttachment
			  )
			: Promise.resolve();

	return await Promise.all([candidatePromise, interviewerPromise]);
};
/**
 * Resend candidate invitation / Reminder
 */
export const resendCandidateReminder = async (data: {
	interviewId: string;
	candidateEmail: string;
	candidateName: string;
	positionTitle: string;
	scheduledStart: Date;
	candidateAccessKey?: string | null;
}) => {
	const dateStr = data.scheduledStart.toLocaleDateString();
	const timeStr = data.scheduledStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	// Base link
	const baseLink = `${APP_URL}/interview/${data.interviewId}`;
	// Candidate specific link with auth params
	const candidateJoinLink = data.candidateAccessKey
		? `${baseLink}?email=${encodeURIComponent(data.candidateEmail)}&candidate_access_key=${
				data.candidateAccessKey
		  }&interviewId=${data.interviewId}`
		: baseLink;

	return await sendEmail(
		data.candidateEmail,
		`Reminder: Interview for ${data.positionTitle}`,
		`
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Interview Reminder</h2>
            <p>Hi ${data.candidateName},</p>
            <p>This is a reminder about your upcoming interview for the <strong>${data.positionTitle}</strong> position.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Date:</strong> ${dateStr}</p>
                <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${timeStr}</p>
            </div>
            <p>You can join the interview directly using the link below:</p>
            <a href="${candidateJoinLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px 0;">Join Interview Lobby</a>
            <p>Please make sure to check your audio and video settings before joining.</p>
            <p>Best regards,<br>The Recruitment Team</p>
        </div>
        `
	);
};
