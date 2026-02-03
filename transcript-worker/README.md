# Transcript Worker

Worker that processes completed interview sessions and fetches transcripts from S3.

## Setup

```bash
pnpm install
```

## Environment Variables

Copy from `.env.example` or set:

```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket
AWS_SQS_TRANSCRIPT_QUEUE_URL=your-transcript-queue-url
```

## Development

```bash
pnpm dev
```

## Production

```bash
pnpm start
```
