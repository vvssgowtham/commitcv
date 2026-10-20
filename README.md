# Resumate AI

Tailor an ATS-friendly resume to each job: paste a job description or URL, pull your best projects from GitHub, export a PDF.

**Stack:** Next.js (App Router, TS) · Tailwind v4 · Postgres + Drizzle · Auth.js (GitHub OAuth) · Zod

## Setup

```bash
cp .env.example .env.local   # fill in values
docker compose up -d         # local Postgres
npm run db:migrate
npm run dev
```

- Schema: `src/db/schema.ts`. Resume upload and the manual form both populate `candidate_profiles` + section tables (single source of truth).
- UI references per surface: `design/README.md`.
