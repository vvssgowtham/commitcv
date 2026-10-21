CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."repo_index_status" AS ENUM('pending', 'indexing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "repo_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"path" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" halfvec(1024) NOT NULL,
	"tsv" "tsvector" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "index_status" "repo_index_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "indexed_pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "index_error" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "facts" jsonb;--> statement-breakpoint
ALTER TABLE "repo_chunks" ADD CONSTRAINT "repo_chunks_repo_id_github_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_chunks_repo_idx" ON "repo_chunks" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "repo_chunks_embedding_idx" ON "repo_chunks" USING hnsw ("embedding" halfvec_cosine_ops);--> statement-breakpoint
CREATE INDEX "repo_chunks_tsv_idx" ON "repo_chunks" USING gin ("tsv");