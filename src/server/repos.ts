import "server-only";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { githubRepositories, repoChunks } from "@/db/schema";
import type { GrantedRepo } from "@/server/services/github";

export async function listRepos(userId: string) {
  const rows = await db.select().from(githubRepositories).where(eq(githubRepositories.userId, userId)).orderBy(desc(githubRepositories.pushedAt));
  // jsonb doesn't keep key order (it returns shortest keys first), so "first 3 languages" showed
  // HCL, Shell, PLpgSQL for a repo that is 89% TypeScript. Rebuild each map largest share first.
  return rows.map((r) => ({ ...r, languages: r.languages && Object.fromEntries(Object.entries(r.languages).toSorted((a, b) => b[1] - a[1])) }));
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
    // Syncing is what someone does after fixing access (e.g. granting the app more permissions): retry failures.
    await tx.update(githubRepositories).set({ indexStatus: "pending", indexError: null })
      .where(and(eq(githubRepositories.userId, userId), eq(githubRepositories.indexStatus, "failed")));
  });
}

/** Excluding a repo also deletes its index, so its code is no longer kept; including it again re-indexes. */
export async function setRepoIncluded(userId: string, repoId: string, included: boolean) {
  return db.transaction(async (tx) => {
    const [row] = await tx.update(githubRepositories)
      .set(included ? { included } : { included, indexStatus: "pending", indexedPushedAt: null, indexedAt: null, indexError: null, facts: null })
      .where(and(eq(githubRepositories.id, repoId), eq(githubRepositories.userId, userId)))
      .returning({ id: githubRepositories.id });
    if (row && !included) await tx.delete(repoChunks).where(eq(repoChunks.repoId, row.id));
    return !!row;
  });
}

export type RepoRow = Awaited<ReturnType<typeof listRepos>>[number];
