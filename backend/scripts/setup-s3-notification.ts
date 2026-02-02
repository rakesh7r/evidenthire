import { S3Client, PutBucketNotificationConfigurationCommand } from '@aws-sdk/client-s3';
import { SQSClient, SetQueueAttributesCommand } from '@aws-sdk/client-sqs';

// Note: Run this with `bun run setup-s3-notification.ts --env-file=.env.local`

const REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = process.env.AWS_S3_BUCKET;
const SQS_QUEUE_URL = process.env.AWS_SQS_QUEUE_URL;

const s3Client = new S3Client({
	region: REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const sqsClient = new SQSClient({
	region: REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const main = async () => {
	if (!S3_BUCKET || !SQS_QUEUE_URL) {
		console.error('Missing AWS_S3_BUCKET or AWS_SQS_QUEUE_URL in environment.');
		return;
	}

	// extract account id and queue name from url for manual ARN construction if needed,
	// but better to fetch ARN from SQS if possible.
	// URL format: https://sqs.REGION.amazonaws.com/ACCOUNT_ID/QUEUE_NAME
	const parts = SQS_QUEUE_URL.split('/');
	const accountId = parts[3];
	const queueName = parts[4];
	const queueArn = `arn:aws:sqs:${REGION}:${accountId}:${queueName}`;
	const bucketArn = `arn:aws:s3:::${S3_BUCKET}`;

	console.log('Configuration:');
	console.log(`- Bucket: ${S3_BUCKET} (${bucketArn})`);
	console.log(`- Queue: ${SQS_QUEUE_URL} (${queueArn})`);

	// 1. Configure SQS Policy to allow S3 to send messages
	try {
		console.log('\n[1/2] Updating SQS Access Policy...');

		// Define the policy statement
		const policyStatement = {
			Sid: 'AllowS3ToSendMessage',
			Effect: 'Allow',
			Principal: {
				Service: 's3.amazonaws.com',
			},
			Action: 'SQS:SendMessage',
			Resource: queueArn,
			Condition: {
				ArnLike: {
					'aws:SourceArn': bucketArn,
				},
			},
		};

		// Fetch existing policy to append or create new
		// For simplicity and to ensure correctness, we will overwrite or carefully merge.
		// Let's create a fresh policy document to ensure it works.
		const policyDoc = {
			Version: '2012-10-17',
			Statement: [policyStatement],
		};

		const setQueueAttrCmd = new SetQueueAttributesCommand({
			QueueUrl: SQS_QUEUE_URL,
			Attributes: {
				Policy: JSON.stringify(policyDoc),
			},
		});

		await sqsClient.send(setQueueAttrCmd);
		console.log('✅ SQS Policy updated successfully.');
	} catch (error) {
		console.error('❌ Failed to update SQS Policy:', error);
		// Proceeding might fail, but let's try.
	}

	// 2. Configure S3 Bucket Notifications
	try {
		console.log('\n[2/2] Configuring S3 Bucket Notifications...');

		const putBucketNotificationCmd = new PutBucketNotificationConfigurationCommand({
			Bucket: S3_BUCKET,
			NotificationConfiguration: {
				QueueConfigurations: [
					{
						Id: 'AudioFileCreated',
						QueueArn: queueArn,
						Events: ['s3:ObjectCreated:*'],
						Filter: {
							Key: {
								FilterRules: [
									{
										Name: 'suffix',
										Value: '.ts',
									},
								],
							},
						},
					},
					{
						Id: 'PlaylistFileCreated', // Optional: if you want to know about playlists too, but usually .ts is enough for data
						QueueArn: queueArn,
						Events: ['s3:ObjectCreated:*'],
						Filter: {
							Key: {
								FilterRules: [
									{
										Name: 'suffix',
										Value: '.m3u8',
									},
								],
							},
						},
					},
				],
			},
		});

		await s3Client.send(putBucketNotificationCmd);
		console.log('✅ S3 Notification configuration updated successfully.');
	} catch (error) {
		console.error('❌ Failed to configure S3 Notifications:', error);
	}
};

main();
