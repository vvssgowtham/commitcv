import "server-only";
import { and, cosineDistance, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { githubRepositories as repos, repoChunks as chunks } from "@/db/schema";
import { embedQueries } from "@/server/services/embeddings";

export type FoundChunk = {
  id: string; repoId: string; repoName: string; path: string; startLine: number; endLine: number;
  kind: "readme" | "doc" | "code"; text: string; score: number;
};

// Reciprocal rank fusion (Cormack et al.): robust to the two rankings having unrelated score scales.
const RRF_K = 60;
const CANDIDATES = 30; // per query, per ranking

/** Merge ranked id lists: each list contributes 1/(k + rank) for every id it contains. */
export function fuse(rankings: string[][]) {
  const score = new Map<string, number>();
  for (const list of rankings) list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (RRF_K + i + 1)));
  return [...score].sort((a, b) => b[1] - a[1]);
}

// Words that match nearly every chunk and only add noise to the full-text ranking ("code", "with", "and").
const COMMON = new Set("a an and are as at be by build built building code create develop experience for from has have in into is it its of on or the to use using with work working years strong ability knowledge".split(" "));

/** Words of a query for full-text OR-matching. Only plain word characters, so nothing reaches to_tsquery unescaped. */
export const queryTerms = (q: string) => [...new Set(q.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])].filter((w) => !COMMON.has(w)).slice(0, 30);

/**
 * Hybrid search over a user's own included repos: vector similarity finds what a requirement *means*,
 * full-text finds exact names ("Razorpay", "Kafka") that embeddings can blur. Each query is searched
 * both ways and every ranking is fused, so a chunk relevant to several requirements rises.
 */
export async function searchRepos(userId: string, queries: string[], opts: { repoIds?: string[]; limit?: number } = {}): Promise<FoundChunk[]> {
  if (!queries.length) return [];
  const scope = and(eq(repos.userId, userId), eq(repos.included, true), opts.repoIds ? inArray(repos.id, opts.repoIds) : undefined);
  const vectors = await embedQueries(queries);
  const rankings: string[][] = [];
  for (const [i, q] of queries.entries()) {
    const byMeaning = await db.select({ id: chunks.id }).from(chunks).innerJoin(repos, eq(repos.id, chunks.repoId))
      .where(scope).orderBy(cosineDistance(chunks.embedding, vectors[i])).limit(CANDIDATES);
    rankings.push(byMeaning.map((r) => r.id));
    const terms = queryTerms(q);
    if (terms.length) {
      const tsq = sql`to_tsquery('simple', ${terms.join(" | ")})`;
      const byWords = await db.select({ id: chunks.id }).from(chunks).innerJoin(repos, eq(repos.id, chunks.repoId))
        .where(and(scope, sql`${chunks.tsv} @@ ${tsq}`)).orderBy(sql`ts_rank_cd(${chunks.tsv}, ${tsq}) desc`).limit(CANDIDATES);
      rankings.push(byWords.map((r) => r.id));
    }
  }
  const top = fuse(rankings).slice(0, opts.limit ?? 12);
  if (!top.length) return [];
  const rows = await db.select({
    id: chunks.id, repoId: chunks.repoId, repoName: repos.name, path: chunks.path, startLine: chunks.startLine,
    endLine: chunks.endLine, kind: chunks.kind, text: chunks.text,
  }).from(chunks).innerJoin(repos, eq(repos.id, chunks.repoId)).where(and(scope, inArray(chunks.id, top.map(([id]) => id))));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return top.flatMap(([id, score]) => (byId.has(id) ? [{ ...byId.get(id)!, score }] : []));
}
