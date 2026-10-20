import { bigint, boolean, date, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());
const userId = () => uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" });
const profileId = () => uuid("profile_id").notNull().references(() => candidateProfiles.id, { onDelete: "cascade" });

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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.providerId, t.accountId)],
);

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
  },
  (t) => [unique().on(t.userId, t.githubRepoId)],
);

// Generated resume and PDF for one job.
export const resumeGenerations = pgTable("resume_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceResumeId: uuid("source_resume_id").references(() => resumes.id, { onDelete: "set null" }), // null when built from the profile form
  generatedContent: jsonb("generated_content").notNull(),
  pdfFileKey: text("pdf_file_key"),
  atsAnalysis: jsonb("ats_analysis"),
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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// end_date null = present
export const candidateEducation = pgTable("candidate_education", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  institution: text("institution").notNull(),
  degree: text("degree"),
  fieldOfStudy: text("field_of_study"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  grade: text("grade"),
  description: text("description"),
});

export const candidateExperience = pgTable("candidate_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  company: text("company").notNull(),
  jobTitle: text("job_title").notNull(),
  employmentType: text("employment_type"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  description: text("description"),
});

export const candidateProjects = pgTable("candidate_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
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
    skill: text("skill").notNull(),
    category: text("category"),
  },
  (t) => [unique().on(t.profileId, t.skill)],
);

export const candidateCertifications = pgTable("candidate_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  name: text("name").notNull(),
  issuingOrganization: text("issuing_organization"),
  issueDate: date("issue_date"),
  credentialUrl: text("credential_url"),
});

export const candidateAwards = pgTable("candidate_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  date: date("date"),
  description: text("description"),
});

export const profileSourceType = pgEnum("profile_source_type", ["RESUME", "MANUAL", "GITHUB", "USER_EDIT"]);

// Where profile data came from, e.g. RESUME → resumes.id, GITHUB → github_repositories.id.
export const candidateProfileSources = pgTable("candidate_profile_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: profileId(),
  sourceType: profileSourceType("source_type").notNull(),
  sourceReference: text("source_reference"),
  createdAt: createdAt(),
});
