CREATE TABLE "ai_usage_daily" (
	"day" date NOT NULL,
	"provider" text NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_daily_day_provider_pk" PRIMARY KEY("day","provider")
);
