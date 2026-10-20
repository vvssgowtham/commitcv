import "server-only";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { githubRepositories } from "@/db/schema";
import type { GrantedRepo } from "@/server/services/github";

export async function listRepos(userId: string) {
  return db.select().from(githubRepositories).where(eq(githubRepositories.userId, userId)).orderBy(desc(githubRepositories.pushedAt));
}

/** Mirror the granted repos: upsert what's granted (keeping the user's `included` choice), drop what isn't. */
export async function saveSyncedRepos(userId: string, granted: GrantedRepo[]) {
  await db.transaction(async (tx) => {
    for (const r of granted) {
      const { name, url, description, languages, topics, readmeExcerpt, stars, isPrivate, pushedAt } = r;
      await tx.insert(githubRepositories)
        .values({ ...r, userId, syncedAt: new Date() })
        .onConflictDoUpdate({
          target: [githubRepositories.userId, githubRepositories.githubRepoId],
          set: { name, url, description, languages, topics, readmeExcerpt, stars, isPrivate, pushedAt, syncedAt: new Date() }, // not `included`
        });
    }
    const ids = granted.map((r) => r.githubRepoId);
    await tx.delete(githubRepositories).where(and(eq(githubRepositories.userId, userId), ids.length ? notInArray(githubRepositories.githubRepoId, ids) : undefined));
  });
}

export async function setRepoIncluded(userId: string, repoId: string, included: boolean) {
  const [row] = await db.update(githubRepositories).set({ included })
    .where(and(eq(githubRepositories.id, repoId), eq(githubRepositories.userId, userId)))
    .returning({ id: githubRepositories.id });
  return !!row;
}

export type RepoRow = Awaited<ReturnType<typeof listRepos>>[number];
