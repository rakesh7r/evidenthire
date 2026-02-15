# Evident Hiring - Technical Documentation

## 1. System Architecture

The following diagram illustrates the high-level architecture and data flow of the Evident Hiring platform.

```mermaid
graph TD
    Client[Next.js Client]

    subgraph "Backend Layer"
        API[Hono.js API Server]
        AudioWorker[Audio Processing Worker]
    end

    subgraph "Real-Time Layer"
        LiveKit[LiveKit Server]
    end

    subgraph "Data Persistence"
        Postgres[(PostgreSQL)]
        Qdrant[(Qdrant Vector DB)]
        Redis[(Redis Cache)]
        S3[(AWS S3 Storage)]
    end

    subgraph "External Services"
        OpenAI[OpenAI API]
        SQS[AWS SQS]
        SES[Email Service (Resend/Nodemailer)]
    end

    %% Client Interactions
    Client -->|HTTPS/REST| API
    Client -->|WebSocket| LiveKit

    %% API Interactions
    API -->|Read/Write| Postgres
    API -->|Cache/PubSub| Redis
    API -->|Semantic Search| Qdrant
    API -->|Generate Token| LiveKit
    API -->|Upload Resumes| S3

    %% Real-Time & Audio Flow
    LiveKit -->|Egress Recording| S3
    S3 -->|Object Created Event| SQS
    SQS -->|Trigger| AudioWorker

    %% Audio Worker Processing
    AudioWorker -->|Fetch Audio| S3
    AudioWorker -->|Transcribe/Analyze| OpenAI
    AudioWorker -->|Save Transcript| S3
    AudioWorker -->|Update Status| Postgres
    AudioWorker -->|Index Vectors| Qdrant
    AudioWorker -->|Read Metadata| Redis

    %% RAG Flow
    API -->|Vector Similarity| Qdrant
    API -->|LLM Completion| OpenAI
```

## 2. Technology Stack & Implementation Details

### 2.1 Backend API (`/backend`)

- **Framework**: **Hono** (running on Node.js/Bun). Chosen for its lightweight footprint and edge readiness.
- **Runtime**: **Bun** is used for development/production for speed, though Node.js is also supported.
- **Database Access**: `postgres.js` for raw, high-performance SQL queries. No heavy ORM is used; we write raw SQL for maximum control.
- **Authentication**: Custom implementation using JWT or Supabase Auth (depending on specific module configuration).
- **Deployment**: Dockerized Node/Bun container.

### 2.2 Client Application (`/client`)

- **Framework**: **Next.js 14+** (App Router).
- **Language**: TypeScript.
- **Styling**: TailwindCSS (inferred from design patterns) / CSS Modules.
- **State Management**: React Server Components (RSC) for data fetching, plus local state for interactivity.
- **Real-Time Video**: `@livekit/components-react` for the interview room interface.

### 2.3 Audio Worker (`/audio-worker`)

A specialized background service designed to handle long-running processes that would block the main API.

- **Trigger Mechanism**: AWS SQS polling. S3 uploads automatically send messages to this queue.
- **Core Dependencies**:
  - `fluent-ffmpeg` / `ffmpeg-static`: For converting MPEG-TS/M4A chunks to MP3/WAV.
  - `openai`: For accessing Whisper (transcription) and GPT-4o (analysis).
- **Workflow**:
  1.  **Receive**: Message from SQS containing S3 Object Key.
  2.  **Download**: Get the audio chunk from S3.
  3.  **Transcribe**: Send to Whisper API with `timestamp_granularities=['segment']` for precise word-level mapping.
  4.  **Index**: Store the transcript segment in S3 as JSON.
  5.  **Merge (End of Session)**: Combine all transcript JSONs, sort by timestamp, and produce a final readable text file.

### 2.4 RAG & Knowledge Engine

- **Vector Database**: **Qdrant**.
- **Embedding Model**: OpenAI `text-embedding-3-small`.
- **Collections**:
  - `qa_spans_vectors`: Stores individual Q&A pairs from interviews.
  - `evidence_vectors`: Stores extracted "evidence" (competency signals).
- **Retrieval Logic**:
  - Incoming queries are embedded.
  - Dense vector search is performed on Qdrant.
  - Results are filtered by `organization_id`, `candidate_id`, etc., to enforce strict data isolation.
  - A "Reranking" step re-scores results based on their metadata confidence scores.

## 3. Database Schema

The following Entity-Relationship Diagram (ERD) represents the PostgreSQL schema.

![Database Schema](./schema.png)

## 4. Key Data Flows

### 4.1 Audio Processing Pipeline

1.  **LiveKit Egress** -> Writes `.m4a` file to `s3://bucket/interview_id/audio/chunk_001.m4a`.
2.  **S3 Event Notification** -> Pushes event to `sqs-queue`.
3.  **Audio Worker** -> Polls SQS, sees new object.
4.  **Processing**:
    - Downloads `chunk_001.m4a`.
    - Converts to `wav` (if needed).
    - Calls OpenAI Whisper API.
    - Receives JSON: `[{ start: 0.0, end: 5.2, text: "Hello..." }]`.
5.  **Output**: Writes `s3://bucket/interview_id/transcripts/parts/chunk_001.json`.

### 4.2 Application Submission & Resume Parsing

1.  **Frontend**: User Uploads PDF.
2.  **API**:
    - Streams file to S3: `s3://bucket/resumes/uuid.pdf`.
    - Reads file buffer using `pdf-parse`.
    - Extracts raw text.
3.  **AI Service**:
    - Prompts GPT-4o with Position Requirements + Raw Resume Text.
    - Requests JSON output matching `CVAnalysis` schema.
4.  **DB Update**:
    - Creates `candidate` record (if new).
    - Creates `application` record with `cv_analysis` JSONB.

### 4.3 RAG Retrieval

1.  **User Query**: "Is the candidate good at Python?"
2.  **Embedding**: `generateEmbedding("Is the candidate good at Python?")` -> `[0.012, -0.23, ...]`.
3.  **Qdrant Search**:
    ```json
    {
      "vector": [...],
      "filter": { "must": [{ "key": "candidate_id", "match": { "value": "uuid..." } }] }
    }
    ```
4.  **Response Generation**:
    - Retrieved contexts: _"Candidate mentioned building a Django app." (Score: 0.89)_
    - LLM Prompt: "Based on the context, answer the user's question."
    - Final Answer: "Yes, the candidate demonstrated Python proficiency by discussing their Django experience..."

## 5. Security & Access Control

- **JWT Tokens**: Used for API authentication.
- **LiveKit Tokens**: Short-lived, signed tokens generated on the backend with specific permissions (canPublish, canSubscribe) for video rooms.
- **Row-Level Security (Implicit)**: All API queries explicitly filter by `organization_id` derived from the user's authenticated session, preventing cross-tenant data leaks.
- **S3 Presigned URLs**: Used for secure, temporary access to private artifacts (resumes, audio) without exposing bucket credentials to the client.

## 6. Environment Variables

### Backend `.env`

```bash
PORT=8000
DATABASE_URL=postgres://user:pass@host:5432/db
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_SQS_QUEUE_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=...
QDRANT_URL=...
QDRANT_API_KEY=...
```

### Client `.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_LIVEKIT_URL=wss://...
```

---

_Generated by Agent Antigravity_
