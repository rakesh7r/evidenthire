# Evident Hiring - Platform Documentation

## 1. Project Overview

**Evident Hiring** is an advanced, AI-powered recruitment platform designed to streamline the hiring process through intelligent automation. It bridges the gap between traditional Applicant Tracking Systems (ATS) and modern video interviewing tools by integrating real-time communication, automated evidence gathering, and sophisticated AI analysis.

The system is built to provide "Evidence-Based Hiring," ensuring that every hiring decision is backed by concrete data points extracted from resumes, applications, and actual interview conversations.

## 2. System Architecture

The project follows a modern microservices-like architecture, orchestrated via Docker.

### High-Level Components

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
  1.  **Fetch**: Retrieves raw audio chunks (MPEG-TS/M4A) from S3.
  2.  **Convert**: Uses **FFmpeg** to standardize audio formats.
  3.  **Transcribe**: Sends audio to **OpenAI Whisper** to generate virtually instant, accurate transcripts with timestamps.
  4.  **Merge**: Aggregates fragmented transcript parts into a cohesive session transcript.
- **Analysis**:
  - **Evidence Extraction**: Parses the transcript to identify key competencies demonstrated by the candidate.
  - **Hire Signal Generation**: Synthesizes evidence into a structured report with a "Hire/No Hire" recommendation.

### 3.4. Knowledge & Retrieval (RAG)

This module turns unstructured interview data into searchable knowledge.

- **Indexing Service (`rag-indexer`)**: Converts interview transcripts and extracted evidence into vector embeddings using **OpenAI Embeddings**.
- **Storage**: Stores these vectors in **Qdrant** (`qa_spans_vectors`, `evidence_vectors`) along with rich metadata (Candidate ID, Position ID).
- **Retrieval Service**: Enables semantic search. For example, a recruiter can ask, _"Did the candidate mention experience with Docker?"_ and the system attempts to retrieve relevant transcript snippets, even if the exact keyword wasn't used.

## 4. Key Workflows & Interactions

### 4.1. The Interview Lifecycle

1.  **Scheduling**: A recruiter schedules an interview. The **Interview Service** creates a record and generates a unique LiveKit room token.
2.  **Execution**: Participants join the Next.js **Interview Interface**. LiveKit manages the A/V stream.
3.  **Recording (Egress)**: LiveKit Egress streams audio chunks directly to an **S3 Bucket**.
4.  **Event Trigger**: S3 upload events trigger an **SQS** message.
5.  **Processing**: The **Audio Worker** picks up the message, transcribes the chunk, and saves the JSON transcript part back to S3.
6.  **Conclusion**: When the session ends, the worker performs a final merge, runs the specific AI analysis for that interview type, updates the database with the report URL, and indexes the content in Qdrant.

### 4.2. Resume Analysis Flow

1.  **Upload**: Candidate uploads a resume (PDF/DOCX) via the Careers Portal.
2.  **Parsing**: The backend parses the file text.
3.  **Scoring**: The **AI Service** compares the resume contents against the **Position** requirements.
4.  **Storage**: A structured JSON analysis (Skills map, Score, Summary) is stored in the `application` table, giving recruiters instant visual feedback.

### 4.3. The "Chat with Candidate Data" Flow

1.  **Query**: A recruiter asks a question in the dashboard chat.
2.  **Vector Search**: The **RAG Retrieval Service** converts the query to a vector and scans Qdrant for the most relevant interview snippets (QA pairs or Evidence).
3.  **Reranking**: Results are re-ranked based on confidence scores.
4.  **Generation**: The context is fed into GPT-4o to generate a natural language answer citing the specific interview moments.

## 5. Database Schema Highlights

The **PostgreSQL** schema is designed for flexibility and auditability.

- **`organization`**: The root entity for tenancy.
- **`user_account`**: System users (Recruiters, Interviewers).
- **`position`**: Contains `requirements` (JSONB) and `rounds` (JSONB) to allow dynamic restructuring of hiring processes without schema migrations.
- **`interview`**: The central nexus. Connects `candidate`, `position`, and `user_account`. It tracks `report_s3_url` and `evidence_state`.
- **`media_chunk` & `transcript_segment`**: Granular storage of the raw interview data, allowing for precise playback alignment.
- **`interview_report`**: Stores the high-level AI conclusions (`strengths`, `risks`, `alignment_summary`).
- **`entitlement` & `pricing_plan`**: Infrastructure for monetization and usage limits.

---

_Generated by Agent Antigravity_
