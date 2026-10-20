CREATE TYPE "public"."profile_source_type" AS ENUM('RESUME', 'MANUAL', 'GITHUB', 'USER_EDIT');--> statement-breakpoint
CREATE TABLE "candidate_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"date" date,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "candidate_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuing_organization" text,
	"issue_date" date,
	"credential_url" text
);
--> statement-breakpoint
CREATE TABLE "candidate_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"institution" text NOT NULL,
	"degree" text,
	"field_of_study" text,
	"start_date" date,
	"end_date" date,
	"grade" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "candidate_experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"company" text NOT NULL,
	"job_title" text NOT NULL,
	"employment_type" text,
	"start_date" date,
	"end_date" date,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "candidate_profile_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"source_type" "profile_source_type" NOT NULL,
	"source_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text,
	"technologies" jsonb
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"category" text,
	CONSTRAINT "candidate_skills_profile_id_skill_unique" UNIQUE("profile_id","skill")
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"languages" jsonb,
	CONSTRAINT "github_repositories_user_id_github_repo_id_unique" UNIQUE("user_id","github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text,
	"title" text,
	"company" text,
	"description" text NOT NULL,
	"extracted_content" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_generation_projects" (
	"generation_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"selection_reason" text,
	"position" integer NOT NULL,
	CONSTRAINT "resume_generation_projects_generation_id_repository_id_pk" PRIMARY KEY("generation_id","repository_id")
);
--> statement-breakpoint
CREATE TABLE "resume_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source_resume_id" uuid,
	"generated_content" jsonb NOT NULL,
	"pdf_file_key" text,
	"ats_analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"parsed_content" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"auth_provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_auth_provider_id_unique" UNIQUE("auth_provider_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_awards" ADD CONSTRAINT "candidate_awards_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_certifications" ADD CONSTRAINT "candidate_certifications_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_education" ADD CONSTRAINT "candidate_education_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_experience" ADD CONSTRAINT "candidate_experience_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profile_sources" ADD CONSTRAINT "candidate_profile_sources_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_projects" ADD CONSTRAINT "candidate_projects_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_generation_projects" ADD CONSTRAINT "resume_generation_projects_generation_id_resume_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."resume_generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_generation_projects" ADD CONSTRAINT "resume_generation_projects_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_source_resume_id_resumes_id_fk" FOREIGN KEY ("source_resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;