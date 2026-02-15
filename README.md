# Evident Hiring - Platform & Technical Documentation

## 1. Project Overview

**Evident Hiring** is an advanced, AI-powered recruitment platform designed to streamline the hiring process through intelligent automation. It bridges the gap between traditional Applicant Tracking Systems (ATS) and modern video interviewing tools by integrating real-time communication, automated evidence gathering, and sophisticated AI analysis.

The system is built to provide "Evidence-Based Hiring," ensuring that every hiring decision is backed by concrete data points extracted from resumes, applications, and actual interview conversations.

## 2. System Architecture

The project follows a modern microservices-like architecture, orchestrated via Docker.

### High-Level Architecture

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

### Core Components

- **Frontend Client**: A **Next.js** application serving distinct portals for Candidates, Recruiters, and Admins.
- **Backend API**: A **Node.js** server acting as the central nervous system, handling business logic, data persistence, and service orchestration.
- **Audio Intelligence Worker**: A dedicated worker service for heavy-lifting audio processing, transcription, and AI analysis.
- **Real-Time Infrastructure**: **LiveKit** for low-latency video/audio streaming and recording.
- **Data Layer**:
  - **PostgreSQL**: Primary relational database for structured data.
  - **Qdrant**: Vector database for semantic search and RAG (Retrieval Augmented Generation).
  - **Redis**: Caching and session state management.
  - **AWS S3**: Object storage for audio recordings, resume documents, and analysis artifacts.
  - **AWS SQS**: Message queue for decoupling real-time events from background processing.

## 3. Core Modules & Functionality

### 3.1. Frontend Ecosystem (Client)

The frontend is a unified Next.js application responsible for all user interactions.

- **Landing & Marketing**: Public-facing pages to convert visitors (Applicants/Customers).
- **Careers Portal**: A dynamic job board where candidates can view openings and apply.
- **Recruiter Dashboard**: The command center for hiring teams to manage positions, review applications, and schedule interviews.
- **Interview Interface**: A specialized, real-time video conferencing room built on LiveKit, providing interviewers with tools like question guides and note-taking.
- **Onboarding & Auth**: Secure authentication flows (Login, Reset Password) and new organization onboarding.

### 3.2. Backend Services (API)

The backend is structured into domain-specific services that encapsulate business logic:

- **Organization Service**: Manages multi-tenancy, ensuring data isolation between different companies.
- **Position Service**: Handles job requisitions, defining interview rounds, and skills requirements.
- **Candidate & Application Service**: Manages candidate profiles and the lifecycle of their applications (Pending -> Reviewed -> Shortlisted).
- **Interview Service**: The core engine managing the interview lifecycle (Scheduled -> In Progress -> Completed), participant access, and state transitions.
- **AI Service**: Centralized interface for LLM interactions (OpenAI), handling tasks like resume scoring and interview signal generation.

### 3.3. Audio Intelligence Engine (Audio Worker)

This is the system's "ears." It operates asynchronously to process raw interview data.

- **Ingestion**: Listens to **SQS** queues for `track_published` (new audio chunk) and `session_ended` events.
- **Processing Pipeline**:
  - **Fetch**: Retrieves raw audio chunks (MPEG-TS/M4A) from S3.
  - **Convert**: Uses **FFmpeg** to standardize audio formats.
  - **Transcribe**: Sends audio to **OpenAI Whisper** to generate virtually instant, accurate transcripts with timestamps.
  - **Merge**: Aggregates fragmented transcript parts into a cohesive session transcript.
- **Analysis**:
  - **Evidence Extraction**: Parses the transcript to identify key competencies demonstrated by the candidate.
  - **Hire Signal Generation**: Synthesizes evidence into a structured report with a "Hire/No Hire" recommendation.

### 3.4. Knowledge & Retrieval (RAG)

This module turns unstructured interview data into searchable knowledge.

- **Indexing Service (`rag-indexer`)**: Converts interview transcripts and extracted evidence into vector embeddings using **OpenAI Embeddings**.
- **Storage**: Stores these vectors in **Qdrant** (`qa_spans_vectors`, `evidence_vectors`) along with rich metadata (Candidate ID, Position ID).
- **Retrieval Service**: Enables semantic search. For example, a recruiter can ask, _"Did the candidate mention experience with Docker?"_ and the system attempts to retrieve relevant transcript snippets, even if the exact keyword wasn't used.

## 4. Technology Stack & Implementation Details

### 4.1 Backend API (`/backend`)

- **Framework**: **Hono** (running on Node.js/Bun). Chosen for its lightweight footprint and edge readiness.
- **Runtime**: **Bun** is used for development/production for speed, though Node.js is also supported.
- **Database Access**: `postgres.js` for raw, high-performance SQL queries. No heavy ORM is used; we write raw SQL for maximum control.
- **Authentication**: Custom implementation using JWT or Supabase Auth (depending on specific module configuration).
- **Deployment**: Dockerized Node/Bun container.

### 4.2 Client Application (`/client`)

- **Framework**: **Next.js 14+** (App Router).
- **Language**: TypeScript.
- **Styling**: TailwindCSS (inferred from design patterns) / CSS Modules.
- **State Management**: React Server Components (RSC) for data fetching, plus local state for interactivity.
- **Real-Time Video**: `@livekit/components-react` for the interview room interface.

### 4.3 Audio Worker (`/audio-worker`)

A specialized background service designed to handle long-running processes that would block the main API.

- **Trigger Mechanism**: AWS SQS polling. S3 uploads automatically send messages to this queue.
- **Core Dependencies**:
  - `fluent-ffmpeg` / `ffmpeg-static`: For converting MPEG-TS/M4A chunks to MP3/WAV.
  - `openai`: For accessing Whisper (transcription) and GPT-4o (analysis).

### 4.4 RAG & Knowledge Engine

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

## 5. Key Workflows & Data Flows

### 5.1 The Interview Lifecycle (Functional)

1.  **Scheduling**: A recruiter schedules an interview. The **Interview Service** creates a record and generates a unique LiveKit room token.
2.  **Execution**: Participants join the Next.js **Interview Interface**. LiveKit manages the A/V stream.
3.  **Recording (Egress)**: LiveKit Egress streams audio chunks directly to an **S3 Bucket**.
4.  **Processing**: The **Audio Worker** picks up the message, transcribes the chunk, and saves the JSON transcript part back to S3.
5.  **Conclusion**: When the session ends, the worker performs a final merge, runs the specific AI analysis for that interview type, updates the database with the report URL, and indexes the content in Qdrant.

### 5.2 Audio Processing Pipeline (Technical)

1.  **LiveKit Egress** -> Writes `.m4a` file to `s3://bucket/interview_id/audio/chunk_001.m4a`.
2.  **S3 Event Notification** -> Pushes event to `sqs-queue`.
3.  **Audio Worker** -> Polls SQS, sees new object.
4.  **Processing**:
    - Downloads `chunk_001.m4a`.
    - Converts to `wav` (if needed).
    - Calls OpenAI Whisper API.
    - Receives JSON: `[{ start: 0.0, end: 5.2, text: "Hello..." }]`.
5.  **Output**: Writes `s3://bucket/interview_id/transcripts/parts/chunk_001.json`.

### 5.3 Resume Analysis Flow

1.  **Upload**: Candidate uploads PDF/DOCX -> S3.
2.  **API**: Streams file to S3 and uses `pdf-parse` to extract raw text.
3.  **AI Service**:
    - Prompts GPT-4o with Position Requirements + Raw Resume Text.
    - Requests JSON output matching `CVAnalysis` schema.
4.  **DB Update**:
    - Creates `candidate` record (if new).
    - Creates `application` record with `cv_analysis` JSONB.

### 5.4 RAG Retrieval ("Chat with Data")

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

## 6. Database Schema

The **PostgreSQL** schema is designed for flexibility and auditability.

![Database Schema](./schema.png)

### Schema Highlights

- **`organization`**: The root entity for tenancy.
- **`user_account`**: System users (Recruiters, Interviewers).
- **`position`**: Contains `requirements` (JSONB) and `rounds` (JSONB) to allow dynamic restructuring of hiring processes without schema migrations.
- **`interview`**: The central nexus. Connects `candidate`, `position`, and `user_account`. It tracks `report_s3_url` and `evidence_state`.
- **`media_chunk` & `transcript_segment`**: Granular storage of the raw interview data, allowing for precise playback alignment.
- **`interview_report`**: Stores the high-level AI conclusions (`strengths`, `risks`, `alignment_summary`).
- **`entitlement` & `pricing_plan`**: Infrastructure for monetization and usage limits.

## 7. Security & Access Control

- **JWT Tokens**: Used for API authentication.
- **LiveKit Tokens**: Short-lived, signed tokens generated on the backend with specific permissions (canPublish, canSubscribe) for video rooms.
- **Row-Level Security (Implicit)**: All API queries explicitly filter by `organization_id` derived from the user's authenticated session, preventing cross-tenant data leaks.
- **S3 Presigned URLs**: Used for secure, temporary access to private artifacts (resumes, audio) without exposing bucket credentials to the client.

## 8. Environment Variables

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

## 9. Test Results & Analysis Report

The system includes a comprehensive testing suite for the transcript processing and analysis pipeline. Below are the results from an end-to-end test flow (`test-transcript-flow.ts`), showcasing the system's ability to extract evidence and generate hiring signals from a mock technical interview.

### 9.1 Interview Context

- **Candidate Email**: rakeshgandla202@gmail.com
- **Role**: Backend/Fullstack Engineer
- **Topics Covered**: React, Node.js, Architecture, AWS, Docker/Kubernetes, CI/CD.

### 9.2 Generated Analysis Report

The Audio Worker successfully processed the interview transcript and generated the following **Hire Signal**.

> **Recommendation: HIRE** (Confidence: 81%)

**Executive Summary:**

> "The candidate demonstrates strong communication skills, effectively articulating their technical experience and methodologies across various technologies and tools. They exhibit robust problem-solving abilities, showcasing a structured approach to optimizing performance, managing state, and handling deployments. While they show proficiency in debugging and scalability, there is a minor concern regarding their ability to manage complex debugging scenarios without advanced observability tools. Overall, the candidate presents a compelling case for hire."

### 9.3 Key Evidence Extracted

The following table highlights specific competency evidence extracted directly from the transcript by the AI engine.

| Competency          | Evidence & Analysis                                                                                                                                                                      | Confidence |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **Communication**   | "The candidate provides a clear and concise overview of their experience, specifying the technologies they have worked with on both frontend and backend."                               | **0.8**    |
| **Problem Solving** | "The candidate mentions using memoization techniques such as React.memo, useCallback, and useMemo... and optimizing lists with virtualization."                                          | **0.9**    |
| **Architecture**    | "The candidate clearly explains the structure of a Node.js application using a layered architecture, detailing the roles of routes, controllers, services, and repositories."            | **0.9**    |
| **Cloud (AWS)**     | "The candidate mentions using AWS services like load balancers, auto-scaling groups, and CloudWatch for scalable systems."                                                               | **0.7**    |
| **DevOps**          | "The candidate describes using Kubernetes to define deployments, services, and config maps, and mentions using Helm charts."                                                             | **0.7**    |
| **Risk Assessment** | _Risk Identified_: "Potential difficulty in managing complex debugging scenarios without sufficient observability tools." (derived from candidate's answer on K8s debugging challenges). | **0.8**    |

### 9.4 Transcript QA Samples

The system also identifies distinct QA spans for RAG retrieval.

**Q: How do you manage state in a large-scale frontend application?**

> **A**: "In smaller components, I prefer using local state with useState and useReducer. For larger applications, I usually rely on Redux Toolkit or React Query for server state. I also try to colocate state as close to where it’s used as possible to avoid unnecessary re-renders."

**Q: What challenges have you faced while working with Kubernetes?**

> **A**: "Debugging can be challenging, especially around networking and resource limits. Misconfigured readiness or liveness probes can also cause instability. Observability using logs and metrics is critical..."

_Data Source: `audio-worker/test/test_results_2026-02-08T12-29-54-536Z.json`_

## License

This project is licensed under the GNU Affero General Public License v3 (AGPLv3).

If you want to use this software without the obligations of AGPLv3
(e.g. for a closed-source or commercial SaaS offering),
contact us for a commercial license.
