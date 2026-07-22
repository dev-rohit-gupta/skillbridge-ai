# SkillBridge AI

A Yarn monorepo for an internship-ready career and skill-gap analysis platform. Students upload a resume, review extracted skills, compare it with a seeded career role or pasted job description, receive an explainable score, and generate a learning roadmap.

## Stack

### Web

- React 19, Vite and TypeScript
- TanStack Query for server state
- Zustand for the in-memory access token
- React Hook Form and shared Zod contracts
- Direct signed uploads to private Supabase Storage

### API

- Express 5 and TypeScript
- Zod request validation
- Short-lived JWT access tokens
- Rotating refresh JWTs in an HttpOnly cookie
- PDF and DOCX extraction
- Deterministic taxonomy-based resume and job matching
- Vercel serverless-compatible app export

### Data and storage

- PostgreSQL through Drizzle ORM
- Neon pooled connection support for serverless runtime
- Neon direct connection support for migrations
- Private Supabase Storage bucket for original resume files

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

- Registration, login, access-token refresh, refresh-token rotation and logout
- Student onboarding and target-role selection
- Five seeded roles: Frontend, Backend, Full-Stack, Data Analyst and UI/UX
- Signed PDF/DOCX uploads with a 5 MB limit
- Private Supabase object download and deletion from the API
- Resume text extraction, canonical skill detection and evidence snippets
- Manual skill addition/removal and revision confirmation
- Pasted job-description extraction and editable requirement review
- Predefined-role and custom-job analyses
- Exact/related matching, evidence factors and deterministic score breakdown
- Analysis history
- Learning-roadmap generation and progress updates
- Dashboard summary

## Requirements

- Node.js 22
- Corepack/Yarn 4
- Neon PostgreSQL project
- Supabase project with a private `resumes` bucket

## Local setup

```bash
corepack enable
corepack prepare yarn@4.17.1 --activate
yarn install
cp .env.example .env
```

Fill the Neon and Supabase values in `.env`, then run:

```bash
yarn db:migrate
yarn db:seed
yarn dev
```

PowerShell:

```powershell
Copy-Item .env.example .env
yarn db:migrate
yarn db:seed
yarn dev
```

Open:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/api/v1/health`

## Resume upload flow

```text
React requests an upload intent
        -> Express creates a resume row and signed Supabase upload URL
        -> Browser uploads the file directly to Supabase Storage
        -> React confirms upload with Express
        -> Express downloads and validates the private file
        -> Express extracts text and skills
        -> Structured data is saved in Neon
```

The original file never passes through the Vercel Function request body.

## Environment variables

See `.env.example`. Important separation:

- `SUPABASE_SERVICE_ROLE_KEY` is backend-only.
- `VITE_SUPABASE_ANON_KEY` is used by the browser only for the signed upload request.
- `DATABASE_URL` should be the Neon pooled URL.
- `DATABASE_URL_DIRECT` should be the Neon direct URL used for migrations.

## Database commands

```bash
yarn db:generate
yarn db:migrate
yarn db:seed
yarn db:studio
```

## Quality checks

```bash
yarn typecheck
yarn test
yarn build
```

## Deployment

Read [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the exact Vercel, Neon and Supabase setup. Before deploying the frontend, replace the backend placeholder in `apps/web/vercel.json`.

## Important implementation notes

- Access JWTs live only in Zustand memory and expire after 15 minutes.
- Refresh JWTs live in an HttpOnly cookie, rotate on every refresh, and are hashed in PostgreSQL.
- Resume files are private objects in Supabase Storage; PostgreSQL stores only the object path and extracted data.
- Resume processing is awaited by the upload-completion request instead of using an unreliable in-process background callback.
- Scores are calculated by backend rules, never generated as arbitrary AI output.
