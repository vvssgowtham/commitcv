# Resumate AI

Tailor an ATS-friendly resume to each job: paste a job description or URL, pull your best projects from GitHub, export a PDF.

**Stack:** Next.js (App Router, TS) · Tailwind v4 · Postgres + Drizzle · Better Auth (GitHub App sign-in, DB sessions, encrypted tokens) · Zod

## Setup

```bash
cp .env.example .env.local   # fill in values
docker compose up -d         # local Postgres
npm run db:migrate
npm run dev
```

## Tests

```bash
npm test                                              # unit tests
TEST_DATABASE_URL=postgres://... npm test             # + integration tests (migrated DB)
```

- Schema: `src/db/schema.ts`. Resume upload and the manual form both populate `candidate_profiles` + section tables (single source of truth).
- UI references per surface: `design/README.md`.

## Auth

- Sign in with a GitHub App (setup notes in `.env.example`). Users grant read-only access to the repos they pick.
- Server code calls `verifySession()` / `getGithubToken()` from `src/lib/dal.ts`; scope every query by `user.id`.
