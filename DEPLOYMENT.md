# Free Deployment: Vercel + Neon + Supabase Storage

This repository is prepared for the following deployment:

- `apps/web` -> Vercel frontend project
- `apps/api` -> Vercel backend project
- PostgreSQL -> Neon
- PDF/DOCX resume objects -> private Supabase Storage bucket

The browser uploads resumes directly to a signed Supabase URL, so the 5 MB file does not pass through the Vercel Function request body. The API then downloads the private object, validates it, extracts text, and stores structured data in Neon.

## 1. Neon

Create a Neon project and copy both connection strings:

- Pooled URL (`-pooler` hostname) -> `DATABASE_URL`
- Direct URL (normal hostname) -> `DATABASE_URL_DIRECT`

Put both in the local root `.env`, then run:

```bash
yarn db:migrate
yarn db:seed
```

The seed is required for career roles, skills, aliases, and role requirements.

## 2. Supabase Storage

Create a Supabase project and a bucket with these settings:

- Bucket name: `resumes`
- Visibility: private
- Maximum file size: 5 MB
- Allowed MIME types:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Copy these values:

- Project URL -> `SUPABASE_URL`
- Service role key -> backend `SUPABASE_SERVICE_ROLE_KEY`
- Anon/publishable key -> frontend `VITE_SUPABASE_ANON_KEY`

Never expose the service role key to the frontend.

## 3. Deploy backend on Vercel

Create a Vercel project from the repository.

- Root Directory: `apps/api`
- Enable: Include source files outside the Root Directory
- Runtime: Node.js
- Do not set an output directory

Recommended build command:

```bash
cd ../.. && yarn build:packages && yarn workspace @skillbridge/api build
```

Backend environment variables:

```env
NODE_ENV=production
DATABASE_URL=YOUR_NEON_POOLED_URL
WEB_ORIGIN=https://YOUR-FRONTEND.vercel.app
ACCESS_TOKEN_SECRET=LONG_RANDOM_SECRET
REFRESH_TOKEN_SECRET=DIFFERENT_LONG_RANDOM_SECRET
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=7
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
SUPABASE_RESUME_BUCKET=resumes
```

Generate each JWT secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Test:

```text
https://YOUR-BACKEND.vercel.app/api/v1/health
```

## 4. Configure and deploy frontend on Vercel

Before deploying, edit `apps/web/vercel.json` and replace:

```text
https://REPLACE-WITH-YOUR-BACKEND.vercel.app
```

with the deployed backend origin. Keep `/api/:path*` in the destination.

Create another Vercel project from the same repository:

- Root Directory: `apps/web`
- Framework: Vite
- Enable: Include source files outside the Root Directory
- Output Directory: `dist`

Recommended build command:

```bash
cd ../.. && yarn build:packages && yarn workspace @skillbridge/web build
```

Frontend environment variables:

```env
VITE_API_URL=/api/v1
VITE_SUPABASE_ANON_KEY=YOUR-SUPABASE-ANON-KEY
```

The Vercel rewrite keeps auth requests on the frontend origin, allowing the refresh-token cookie to remain `SameSite=Lax`.

## 5. Final production test

Test this sequence:

1. Register
2. Refresh the browser and confirm the session restores
3. Complete onboarding
4. Upload a PDF under 5 MB
5. Upload a DOCX under 5 MB
6. Review and confirm extracted skills
7. Run a predefined-role analysis
8. Run a custom-job analysis
9. Generate and update a roadmap
10. Delete a resume and confirm the object disappears from Supabase Storage
11. Log out and log in again
12. Open `/app/dashboard` directly in a new tab to verify SPA routing
