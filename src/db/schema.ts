import { bigint, boolean, customType, date, halfvec, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export type RepoFacts = {
  dependencies: string[];
  infra: string[];
  files: number;
  hasTests: boolean;
  // A fork: everything above describes only the files its own commits changed, never the original's code.
  fork?: { parent: string; commits: number; changedFiles: number };
};

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());
const userId = () => uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" });
const profileId = () => uuid("profile_id").notNull().references(() => candidateProfiles.id, { onDelete: "cascade" });

export const profileSourceType = pgEnum("profile_source_type", ["RESUME", "MANUAL", "GITHUB", "USER_EDIT"]);
export const generationStatus = pgEnum("generation_status", ["pending", "ready", "failed"]);
export const repoIndexStatus = pgEnum("repo_index_status", ["pending", "indexing", "ready", "failed"]);

// Per-item provenance: re-importing a resume may only overwrite RESUME items, never MANUAL / USER_EDIT.
const source = () => profileSourceType("source").notNull().default("MANUAL");

// users / sessions / accounts follow Better Auth's core schema (camelCase keys are what the adapter expects).
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Provider identity + OAuth tokens (encrypted by Better Auth before storage).
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    providerId: text("provider_id").notNull(),
    accountId: text("provider_account_id").notNull(), // GitHub user id
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"), // part of Better Auth's core schema; unused with GitHub-only sign-in
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.providerId, t.accountId)],
);

// Better Auth's core verification table (OAuth state uses a cookie here, but the library expects the table).
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Original uploaded resume and its parsed content.
export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  fileKey: text("file_key").notNull(),
  parsedContent: jsonb("parsed_content"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Job description and extracted requirements.
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  url: text("url"),
  title: text("title"),
  company: text("company"),
  description: text("description").notNull(),
  extractedContent: jsonb("extracted_content"),
  createdAt: createdAt(),
});

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    languages: jsonb("languages").$type<Record<string, number>>(),
    topics: jsonb("topics").$type<string[]>(),
    readmeExcerpt: text("readme_excerpt"),
    stars: integer("stars").notNull().default(0),
    isPrivate: boolean("is_private").notNull().default(false),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    included: boolean("included").notNull().default(true), // user can hide a repo from resume selection
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
    // Code + README index (repo_chunks). Re-indexed only when pushedAt moves past indexedPushedAt.
    indexStatus: repoIndexStatus("index_status").notNull().default("pending"),
    indexedPushedAt: timestamp("indexed_pushed_at", { withTimezone: true }),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    indexError: text("index_error"),
    // Exact facts read from the repo itself (manifests, infra files): the allowed tech list for that repo.
    facts: jsonb("facts").$type<RepoFacts>(),
  },
  (t) => [unique().on(t.userId, t.githubRepoId)],
);

// Generated resume and PDF for one job.
export const resumeGenerations = pgTable("resume_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceResumeId: uuid("source_resume_id").references(() => resumes.id, { onDelete: "set null" }), // null when built from the profile form
  generatedContent: jsonb("generated_content"), // null until status = ready
  pdfFileKey: text("pdf_file_key"),
  atsAnalysis: jsonb("ats_analysis"),
  status: generationStatus("status").notNull().default("pending"),
  error: text("error"),
  createdAt: createdAt(),
});

export const resumeGenerationProjects = pgTable(
  "resume_generation_projects",
  {
    generationId: uuid("generation_id").notNull().references(() => resumeGenerations.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    selectionReason: text("selection_reason"),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.generationId, t.repositoryId] })],
);

// --- Candidate profile: single source of truth, filled from resume upload or the manual form ---

export const candidateProfiles = pgTable("candidate_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId().unique(),
  summary: text("summary"),
  phone: text("phone"),
  location: text("location"),
  links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Dates are "YYYY" or "YYYY-MM" text, exactly as precise as the source; end_date null = present.
export const candidateEducation = pgTable("candidate_education", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  source: source(),
  institution: text("institution").notNull(),
  degree: text("degree"),
  fieldOfStudy: text("field_of_study"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  grade: text("grade"),
  description: text("description"),
});

export const candidateExperience = pgTable("candidate_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  source: source(),
  company: text("company").notNull(),
  jobTitle: text("job_title").notNull(),
  employmentType: text("employment_type"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
});

export const candidateProjects = pgTable("candidate_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  source: source(),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url"),
  technologies: jsonb("technologies").$type<string[]>(),
});

export const candidateSkills = pgTable(
  "candidate_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: profileId(),
    source: source(),
    skill: text("skill").notNull(),
    category: text("category"),
  },
  (t) => [unique().on(t.profileId, t.skill)],
);

export const candidateCertifications = pgTable("candidate_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  source: source(),
  name: text("name").notNull(),
  issuingOrganization: text("issuing_organization"),
  issueDate: text("issue_date"),
  credentialUrl: text("credential_url"),
});

export const candidateAwards = pgTable("candidate_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  source: source(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  date: text("date"),
  description: text("description"),
});

// Where profile data came from, e.g. RESUME → resumes.id, GITHUB → github_repositories.id.
export const candidateProfileSources = pgTable("candidate_profile_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  sourceType: profileSourceType("source_type").notNull(),
  sourceReference: text("source_reference"),
  createdAt: createdAt(),
});

// App-wide AI usage per UTC day and provider. Free-tier limits are shared by every user, so this is
// what the capacity gate checks before starting any AI action.
export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    day: date("day", { mode: "string" }).notNull(),
    provider: text("provider").notNull(),
    tokens: integer("tokens").notNull().default(0),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.provider] })],
);

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

// Chunks of a repo's README, docs and code, embedded for retrieval. `text` is the literal file content
// for lines startLine..endLine, so anything cited from a chunk can be checked against the real file.
export const repoChunks = pgTable(
  "repo_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id").notNull().references(() => githubRepositories.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    kind: text("kind").$type<"readme" | "doc" | "code">().notNull(),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: halfvec("embedding", { dimensions: 1024 }).notNull(),
    // Full-text side of hybrid search, over the text with code identifiers split into words.
    tsv: tsvector("tsv").notNull(),
  },
  (t) => [
    index("repo_chunks_repo_idx").on(t.repoId),
    index("repo_chunks_embedding_idx").using("hnsw", t.embedding.op("halfvec_cosine_ops")),
    index("repo_chunks_tsv_idx").using("gin", t.tsv),
  ],
);
