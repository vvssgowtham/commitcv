# Resumate AI

Tailor an ATS-friendly resume to each job: paste a job description or URL, pull your best projects from GitHub, export a PDF.

**Stack:** Next.js (App Router, TS) · Tailwind v4 · Postgres + Drizzle · Better Auth (GitHub App sign-in, DB sessions, encrypted tokens) · Claude (`claude-opus-5-5`) · Cloudflare R2 · Zod · Vitest

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

## How it works

| Step | Code |
|---|---|
| Upload / re-import resume → parse → profile | `src/server/actions/profile.ts`, `src/server/profile.ts`, `src/server/resume-file.ts` |
| Sync granted GitHub repos | `src/server/actions/repos.ts`, `src/server/services/github.ts` |
| Analyse a job (link or text) with grounded matching | `src/server/actions/jobs.ts`, `src/server/jobs.ts`, `src/server/grounding.ts` |
| Generate resume + PDF | `src/server/actions/generate.ts`, `src/server/generate.ts`, `src/server/services/pdf.tsx` |

**No invented facts.** Names, employers, titles, dates, education and certifications are copied from the database. The model only selects, orders and rephrases; `src/server/resume-grounding.ts` rejects any bullet or summary that adds a number or technology its source doesn't contain and falls back to the user's own words.

- Schema: `src/db/schema.ts`. Resume upload and the manual form both populate `candidate_profiles` + section tables (single source of truth).
- UI references per surface: `design/README.md`.

## Auth

- Sign in with a GitHub App (setup notes in `.env.example`). Users grant read-only access to the repos they pick.
- Server code calls `verifySession()` / `getGithubToken()` from `src/lib/dal.ts`; scope every query by `user.id`.
