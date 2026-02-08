import { sql } from '../db';

// Script to update report URL for a specific interview
// Usage: bun scripts/update_report_url.ts

const updateReportUrl = async (interviewId: string, s3Url: string) => {
	console.log(`Updating report URL for interview ${interviewId}...`);
	console.log(`New URL: ${s3Url}`);

	try {
		// Simple update
		const query = await sql`
            UPDATE interview 
            SET report_s3_url = ${s3Url} 
            WHERE id = ${interviewId}
            RETURNING id, report_s3_url
        `;

		if (query.length > 0) {
			console.log('✅ Successfully updated report URL.');
			console.log(query[0]);
		} else {
			console.log('⚠️ Interview not found or no change made.');
		}
	} catch (error) {
		console.error('❌ Error updating report URL:', error);
	} finally {
		process.exit(0);
	}
};

// Hardcoded values from user request
const INTERVIEW_ID = '99fe4069-503e-4503-afef-0cb15937042e';
// User provided `s3://...` but we should probably store the HTTP URL if that's what the frontend consumes?
// The backend code in audio-worker/index.ts constructs an HTTPS URL: `https://${bucket}.s3.${region}.amazonaws.com/${reportParamsKey}`
// However, the user explicitly asked to "update this report url `s3://...`".
// I will blindly follow the user's request and store the s3:// string.
// If they meant for me to convert it, they usually would say "the report at ...".
// But "update this report url `s3://...`" is specific.
// Wait, looking at previous step 1536, I implemented:
// `const s3Url = https://${bucket}.s3.${region}.amazonaws.com/${reportParamsKey};`
// Storing s3:// might break frontend if it expects https.
// But the user might want s3:// for internal use or presigned URL generation?
// I'll stick to what the user provided: `s3://evident-audio-store/99fe4069-503e-4503-afef-0cb15937042e/transcripts/report.json`

const S3_URL = 's3://evident-audio-store/99fe4069-503e-4503-afef-0cb15937042e/transcripts/report.json';

updateReportUrl(INTERVIEW_ID, S3_URL);
