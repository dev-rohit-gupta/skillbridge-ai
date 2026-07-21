# SkillBridge AI

A complete Yarn monorepo for an internship-ready career and skill-gap analysis platform. Students upload a resume, review extracted skills, compare it with a seeded career role or pasted job description, receive an explainable score, and generate a learning roadmap.

## Stack

### Web
- React 19 + Vite + TypeScript
- TanStack Query for server state
- Zustand for the in-memory access token
- React Hook Form + shared Zod contracts
- Responsive custom CSS UI

### API
- Express 5 + TypeScript
- Zod request validation
- Short-lived JWT access tokens
- Rotating JWT refresh tokens in an HttpOnly cookie
- PDF and DOCX extraction
- Deterministic taxonomy-based resume and job matching

### Data
- PostgreSQL 17
- Drizzle ORM and committed SQL migration
- Seeded skills, aliases, relationships, five career roles and weighted requirements

## Workspace layout

```text
apps/
  api/                 Express API and tests
  web/                 React application
packages/
  database/            Drizzle schema, migration and seed
  shared/              Shared Zod schemas and TypeScript contracts
```

## Included flows

- Registration, login, refresh-token rotation, logout and `/auth/me`
- Student onboarding and target-role selection
- Five seeded roles: Frontend, Backend, Full-Stack, Data Analyst and UI/UX
- Resume upload with PDF/DOCX validation and 5 MB limit
- Resume text extraction, canonical skill detection and evidence snippets
- Manual skill addition/removal and revision confirmation
- Pasted job-description extraction and editable requirement review
- Predefined-role and custom-job analyses
- Exact/related matching, evidence factors and deterministic score breakdown
- Analysis history
- Learning-roadmap generation and progress updates
- Dashboard summary

The default `DeterministicAiProvider` works offline and implements a provider interface. A watsonx.ai or another hosted provider can later implement the same interface without changing the analysis domain.

## Requirements

- Node.js 22
- Corepack/Yarn 4
- Docker Desktop or a reachable PostgreSQL database

## Start locally

```bash
corepack enable
corepack prepare yarn@4.17.1 --activate
yarn install
cp .env.example .env
docker compose up -d postgres
yarn db:migrate
yarn db:seed
yarn dev
```

PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
yarn db:migrate
yarn db:seed
yarn dev
```

Open:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/api/v1/health`

## Environment variables

Copy `.env.example` and replace both JWT secrets before sharing a deployed environment.

```env
DATABASE_URL=postgresql://skillbridge:skillbridge@localhost:5432/skillbridge
PORT=4000
WEB_ORIGIN=http://localhost:5173
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-characters
REFRESH_TOKEN_SECRET=replace-with-another-at-least-32-random-characters
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=7
UPLOAD_DIR=./uploads
VITE_API_URL=/api/v1
```

## Database commands

```bash
yarn db:generate   # create a migration after changing schema
yarn db:migrate    # apply committed migrations
yarn db:seed       # seed taxonomy and role matrices
yarn db:studio     # open Drizzle Studio
```

## Quality checks

```bash
yarn typecheck
yarn test
yarn build
```

The API tests cover deterministic scoring and custom job-requirement extraction. The repository was verified with all three commands before packaging.

## Important implementation notes

- Access JWTs live only in Zustand memory and expire after 15 minutes.
- Refresh JWTs live in an HttpOnly cookie, rotate on every refresh, and are hashed in PostgreSQL.
- Resume files are stored locally in development under `apps/api/uploads`; use private object storage in production.
- Scores are calculated by backend rules, never generated as arbitrary AI output.
- Uploaded resume content and job descriptions are treated as untrusted text.
