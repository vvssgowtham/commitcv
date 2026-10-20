CREATE TYPE "public"."generation_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "resume_generations" ALTER COLUMN "generated_content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_awards" ADD COLUMN "source" "profile_source_type" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_certifications" ADD COLUMN "source" "profile_source_type" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_education" ADD COLUMN "source" "profile_source_type" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_experience" ADD COLUMN "source" "profile_source_type" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_projects" ADD COLUMN "source" "profile_source_type" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "source" "profile_source_type" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "topics" jsonb;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "readme_excerpt" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "stars" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "included" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_generations" ADD COLUMN "status" "generation_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_generations" ADD COLUMN "error" text;