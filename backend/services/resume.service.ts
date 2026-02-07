import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
	region: process.env.AWS_REGION || 'ap-south-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const RESUME_BUCKET = process.env.AWS_S3_RESUME_BUCKET || 'evidenthire-resumes';

/**
 * Generate a unique S3 key for a resume
 * Format: {positionId}/{email_hash}/{timestamp}_{originalFilename}
 */
function generateResumeS3Key(positionId: string, email: string, filename: string): string {
	// Create a simple hash of the email to avoid special characters in S3 keys
	const emailHash = Buffer.from(email.toLowerCase()).toString('base64').replace(/[/+=]/g, '_');
	const timestamp = Date.now();
	// Sanitize filename to remove special characters
	const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
	return `${positionId}/${emailHash}/${timestamp}_${sanitizedFilename}`;
}

/**
 * Extract S3 key from a full S3 URL
 */
function extractS3KeyFromUrl(s3Url: string): string | null {
	try {
		// Handle both URL formats:
		// https://bucket-name.s3.region.amazonaws.com/key
		// https://s3.region.amazonaws.com/bucket-name/key
		const url = new URL(s3Url);
		// Remove leading slash
		return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
	} catch {
		return null;
	}
}

/**
 * Upload resume to S3
 * @param file - The resume file buffer
 * @param filename - Original filename
 * @param contentType - MIME type of the file
 * @param positionId - Position ID for organizing in S3
 * @param email - Candidate email for organizing in S3
 * @returns S3 URL of the uploaded resume
 */
export async function uploadResumeToS3(
	file: Buffer,
	filename: string,
	contentType: string,
	positionId: string,
	email: string
): Promise<string> {
	const s3Key = generateResumeS3Key(positionId, email, filename);

	const command = new PutObjectCommand({
		Bucket: RESUME_BUCKET,
		Key: s3Key,
		Body: file,
		ContentType: contentType,
		// Add metadata for tracking
		Metadata: {
			'position-id': positionId,
			email: email,
			'uploaded-at': new Date().toISOString(),
		},
	});

	await s3Client.send(command);

	// Return the S3 URL
	const s3Url = `https://${RESUME_BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${s3Key}`;
	return s3Url;
}

/**
 * Delete resume from S3
 * @param s3Url - Full S3 URL of the resume to delete
 */
export async function deleteResumeFromS3(s3Url: string): Promise<void> {
	const s3Key = extractS3KeyFromUrl(s3Url);

	if (!s3Key) {
		console.error('Invalid S3 URL, cannot extract key:', s3Url);
		return;
	}

	try {
		const command = new DeleteObjectCommand({
			Bucket: RESUME_BUCKET,
			Key: s3Key,
		});

		await s3Client.send(command);
		console.log('Deleted resume from S3:', s3Key);
	} catch (error) {
		console.error('Error deleting resume from S3:', error);
		// Don't throw - we don't want to fail the application update if delete fails
	}
}
