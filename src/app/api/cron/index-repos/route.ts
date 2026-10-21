import { timingSafeEqual } from "node:crypto";
import { eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { githubRepositories } from "@/db/schema";
import { env } from "@/env";
import { githubTokenFor } from "@/lib/dal";
import { claimNextRepo, indexRepo } from "@/server/repo-indexer";

// Daily: finishes repos nobody kept the Projects page open for. Vercel Hobby allows one run a day.
export const maxDuration = 300;
const BUDGET_MS = 240_000; // stop claiming new repos with time to finish the last one

const authorized = (header: string | null) => {
  const secret = env().CRON_SECRET;
  if (!secret || !header) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === want.length && timingSafeEqual(got, want);
};

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const started = Date.now();
  const done: Record<string, number> = {};
  const skipUsers: string[] = []; // GitHub access lapsed: their repos wait until they sign in again
  while (Date.now() - started < BUDGET_MS) {
    const repo = await claimNextRepo(skipUsers.length ? notInArray(githubRepositories.userId, skipUsers) : undefined);
    if (!repo) break;
    let outcome: string;
    try {
      outcome = await indexRepo(repo, await githubTokenFor(repo.userId));
    } catch {
      outcome = "github-auth";
      skipUsers.push(repo.userId);
      await db.update(githubRepositories).set({ indexStatus: "pending" }).where(eq(githubRepositories.id, repo.id));
    }
    done[outcome] = (done[outcome] ?? 0) + 1;
    if (outcome === "paused") break; // free allowance spent for everyone
  }
  return Response.json(done);
}
