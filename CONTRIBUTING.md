# Contributing to Evident Hiring

First off, thanks for taking the time to contribute! Every bit of help makes this project better.

This document walks you through how to set up the project locally, write clean code, and submit your work. Nothing complicated — just a few guidelines to keep things organised.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Conventions](#code-conventions)
- [Commit Messages](#commit-messages)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)
- [License](#license)

---

## Prerequisites

Make sure you have the following installed on your machine before you begin:

| Tool          | Version   | Purpose                          |
| :------------ | :-------- | :------------------------------- |
| **Bun**       | >= 1.0    | Runtime & package manager        |
| **Node.js**   | >= 18     | Fallback runtime (if needed)     |
| **PostgreSQL**| >= 15     | Primary database                 |
| **Redis**     | >= 7      | Caching & session management     |
| **Docker**    | Latest    | For containerised services       |
| **FFmpeg**    | Latest    | Audio processing (audio-worker)  |

You'll also need active credentials / accounts for:

- **Supabase** (Auth & DB hosting)
- **OpenAI** (AI analysis & embeddings)
- **AWS** (S3, SQS)
- **LiveKit** (Real-time video)
- **Qdrant** (Vector database)

---

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/evident-hiring.git
cd evident-hiring
```

### 2. Set Up Environment Variables

Each service has its own `.env.example` file. Copy them and fill in your credentials:

```bash
# Backend
cp backend/.env.example backend/.env.local

# Client
cp client/.env.example client/.env.local

# Audio Worker
cp audio-worker/.env.example audio-worker/.env.local
```

> **Important:** Never commit `.env.local` or any file containing real secrets. These are already in `.gitignore`.

### 3. Install Dependencies

We use **Bun** as the package manager across the project.

```bash
# Backend
cd backend && bun install

# Client
cd ../client && bun install

# Audio Worker
cd ../audio-worker && bun install
```

### 4. Run the Services

Open separate terminal tabs for each service:

```bash
# Terminal 1 — Backend API (port 8000)
cd backend && bun dev

# Terminal 2 — Client App (port 3000)
cd client && bun dev

# Terminal 3 — Audio Worker (only if working on audio/transcription features)
cd audio-worker && bun dev
```

---

## Project Structure

```
evident-hiring/
├── backend/            # Hono.js API server (Bun runtime)
│   ├── routes/         # Route handlers (application, interview, position, etc.)
│   ├── services/       # Business logic (ai, email, qdrant, resume, etc.)
│   ├── middleware/      # Auth and other middleware
│   ├── lib/            # Shared utilities (logger, etc.)
│   └── types/          # TypeScript type definitions
│
├── client/             # Next.js 16 frontend (App Router)
│   ├── app/            # Pages and layouts
│   ├── components/     # Reusable UI components
│   ├── lib/            # Client-side utilities
│   └── utils/          # Helper functions
│
├── audio-worker/       # Background audio processing service
│   ├── index.ts        # Main SQS polling & processing loop
│   ├── transcript-processor.ts
│   ├── evidence-extractor.ts
│   ├── rag-indexer.ts  # Vector indexing for Qdrant
│   └── test/           # Test data and scripts
│
└── docker-compose.yml  # Container orchestration
```

---

## Development Workflow

### Branching

We use a simple branching model:

| Branch            | Purpose                              |
| :---------------- | :----------------------------------- |
| `main`            | Stable, production-ready code        |
| `dev`             | Active development & integration     |
| `feature/<name>`  | New features (branch off `dev`)      |
| `fix/<name>`      | Bug fixes (branch off `dev`)         |
| `hotfix/<name>`   | Urgent production fixes (off `main`) |

```bash
# Example: starting a new feature
git checkout dev
git pull origin dev
git checkout -b feature/add-interview-notes
```

### Making Changes

1. **Keep your changes focused.** One PR should solve one problem or add one feature. Avoid mixing unrelated changes.
2. **Write decoupled functions.** Keep business logic in `services/`, route handling in `routes/`, and shared utilities in `lib/`.
3. **No raw SQL in route handlers.** Database queries should live in service files or dedicated query functions.
4. **Update `.env.example`** if you add any new environment variables. This file is committed to git so other contributors know what's needed.

---

## Code Conventions

### General

- **Language:** TypeScript everywhere.
- **Runtime:** Bun for backend and audio-worker. Next.js (with Bun) for client.
- **Formatting:** Use tabs for indentation. Keep lines reasonable (no hard limit, but don't write novels on one line).
- **Imports:** Group imports logically — external packages first, then internal modules.

### Backend (Hono)

- Route files go in `backend/routes/`.
- Business logic goes in `backend/services/`.
- Use the shared `logger` from `lib/logger.ts` — avoid `console.log` in production code.
- Database queries use `postgres.js` (`sql` tagged templates). No ORMs.
- Always filter queries by `organization_id` to maintain data isolation between tenants.

### Client (Next.js)

- Use the App Router (`app/` directory).
- Reusable components go in `components/`.
- Use TailwindCSS for styling.
- Prefer React Server Components where possible; use `"use client"` only when you need interactivity.

### Audio Worker

- Keep processing logic modular — each stage of the pipeline (fetch, convert, transcribe, analyse) should be a separate function.
- Always handle errors gracefully. A failed audio chunk should not crash the entire worker.

---

## Commit Messages

Write clear, concise commit messages. We follow a simple convention:

```
<type>: <short description>

<optional longer explanation>
```

**Types:**

| Type       | When to use                              |
| :--------- | :--------------------------------------- |
| `feat`     | A new feature                            |
| `fix`      | A bug fix                                |
| `refactor` | Code restructuring (no feature/fix)      |
| `docs`     | Documentation changes only               |
| `style`    | Formatting, whitespace (no logic change) |
| `test`     | Adding or updating tests                 |
| `chore`    | Build scripts, dependencies, config      |

**Examples:**

```
feat: add interview notes to recruiter dashboard
fix: correct missing INSERT clause in application query
docs: update README with audio worker setup instructions
refactor: extract resume parsing into its own service
```

---

## Submitting a Pull Request

1. **Push your branch** to your fork.
2. **Open a Pull Request** against the `dev` branch (not `main`).
3. **Fill out the PR description** — explain what you changed and why. If it fixes an issue, reference it (e.g., `Fixes #42`).
4. **Keep it small.** Smaller PRs are easier to review and merge faster.
5. **Make sure the app runs.** Before submitting, verify that `bun dev` starts without errors for the services you touched.

### PR Checklist

- [ ] Code follows the project's conventions
- [ ] New environment variables are added to `.env.example`
- [ ] No console.log statements left in production code
- [ ] Tested locally and the feature works as expected
- [ ] PR description clearly explains the change

---

## Reporting Issues

Found a bug or have a suggestion? Open an issue and include:

1. **A clear title** that summarises the problem.
2. **Steps to reproduce** — what did you do, and what happened?
3. **Expected behaviour** — what should have happened instead?
4. **Environment details** — OS, Bun version, browser (if frontend issue).
5. **Error logs or screenshots** — paste the relevant terminal output or attach a screenshot.

---

## License

By contributing to Evident Hiring, you agree that your contributions will be licensed under the [GNU Affero General Public License v3 (AGPLv3)](./LICENSE).

If you need to use this software under different licensing terms (e.g., for a closed-source or commercial offering), please reach out to discuss a commercial license.

---

Thanks again for contributing. Happy coding! 🚀
