import { bigint, boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { ResumeData } from "@/lib/resume";

// --- Auth.js tables (shape required by @auth/drizzle-adapter) ---
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"), // GitHub token used to read the user's repos
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// --- App tables ---
const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());
const userId = () => text("user_id").notNull().references(() => users.id, { onDelete: "cascade" });

// Form filled when the user has no resume to upload; becomes their initial resume data.
export const resumeIntake = pgTable("resume_intake", {
  userId: userId().primaryKey(),
  data: jsonb("data").$type<Partial<ResumeData>>().notNull().default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const resumeSource = pgEnum("resume_source", ["upload", "intake", "generated"]);

export const resumes = pgTable("resume", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  source: resumeSource("source").notNull(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }), // set when tailored to a job
  data: jsonb("data").$type<ResumeData>().notNull(),
  isBase: boolean("is_base").notNull().default(false),
  createdAt,
  updatedAt,
});

export const jobs = pgTable("job", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  url: text("url"),
  company: text("company"),
  title: text("title"),
  description: text("description").notNull(),
  // Extracted by the model: required/nice-to-have skills, keywords, seniority, missing info to ask for.
  analysis: jsonb("analysis").$type<Record<string, unknown>>(),
  createdAt,
});

export const githubRepos = pgTable("github_repo", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  githubId: bigint("github_id", { mode: "number" }).notNull(),
  fullName: text("full_name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  languages: jsonb("languages").$type<Record<string, number>>(),
  topics: jsonb("topics").$type<string[]>(),
  stars: integer("stars").notNull().default(0),
  isPrivate: boolean("is_private").notNull().default(false),
  readme: text("readme"),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique().on(t.userId, t.githubId)]);
