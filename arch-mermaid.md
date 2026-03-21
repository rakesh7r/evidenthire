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
