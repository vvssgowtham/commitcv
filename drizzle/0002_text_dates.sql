ALTER TABLE "candidate_awards" ALTER COLUMN "date" SET DATA TYPE text USING to_char("date", 'YYYY-MM');--> statement-breakpoint
ALTER TABLE "candidate_certifications" ALTER COLUMN "issue_date" SET DATA TYPE text USING to_char("issue_date", 'YYYY-MM');--> statement-breakpoint
ALTER TABLE "candidate_education" ALTER COLUMN "start_date" SET DATA TYPE text USING to_char("start_date", 'YYYY-MM');--> statement-breakpoint
ALTER TABLE "candidate_education" ALTER COLUMN "end_date" SET DATA TYPE text USING to_char("end_date", 'YYYY-MM');--> statement-breakpoint
ALTER TABLE "candidate_experience" ALTER COLUMN "start_date" SET DATA TYPE text USING to_char("start_date", 'YYYY-MM');--> statement-breakpoint
ALTER TABLE "candidate_experience" ALTER COLUMN "end_date" SET DATA TYPE text USING to_char("end_date", 'YYYY-MM');