import "server-only";
import { and, count, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { githubRepositories, repoChunks } from "@/db/schema";
import { addedRanges, chunkRepo, embeddingInput, keepForkWork, MAX_DOWNLOAD_BYTES, readTarball, repoFacts, searchText, type ForkWork } from "@/server/repo-index";
import { embedDocuments } from "@/server/services/embeddings";
import { GithubAuthError } from "@/server/services/github";
import { CapacityError } from "@/server/services/llm";

const repos = githubRepositories;
// A run that started this long ago and never finished (process died, deploy) may be picked up again.
const STALE_MS = 10 * 60 * 1000;

/** Included repos whose index is missing or out of date. Failed repos wait for new commits. */
const needsIndex = () => and(
  eq(repos.included, true),
  or(
    eq(repos.indexStatus, "pending"),
    and(inArray(repos.indexStatus, ["ready", "failed"]), sql`${repos.pushedAt} is distinct from ${repos.indexedPushedAt}`),
    and(eq(repos.indexStatus, "indexing"), lt(repos.indexedAt, new Date(Date.now() - STALE_MS))),
  ),
)!;

/** Atomically claim one repo to index: the update re-checks the condition, so two tabs (or the cron and
 * a tab) can't index the same repo at once. */
export async function claimNextRepo(scope?: SQL) {
  const where = scope ? and(scope, needsIndex())! : needsIndex();
  const candidates = await db.select({ id: repos.id }).from(repos).where(where).orderBy(desc(repos.pushedAt)).limit(5);
  for (const { id } of candidates) {
    const [row] = await db.update(repos).set({ indexStatus: "indexing", indexedAt: new Date() }).where(and(eq(repos.id, id), where)).returning();
    if (row) return row;
  }
  return null;
}

export async function reposLeftToIndex(userId: string) {
  const [{ n }] = await db.select({ n: count() }).from(repos).where(and(eq(repos.userId, userId), needsIndex()));
  return n;
}

const ghHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
const ownerAndName = (repoUrl: string) => new URL(repoUrl).pathname.slice(1).split("/") as [string, string];

async function gh<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders(token) });
  if (res.status === 401) throw new GithubAuthError();
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${path.split("?")[0]}`);
  return res.json() as Promise<T>;
}

/**
 * For a fork: what its own commits (not the original repo's owner's) added — whole files they created,
 * and only the changed lines of files they modified. Only that is the user's work; the rest of a fork
 * (its README, its app) was written by someone else. Returns null for a repo that isn't a fork.
 */
async function forkChanges(repoUrl: string, token: string) {
  const [owner, name] = ownerAndName(repoUrl);
  const meta = await gh<{ fork: boolean; default_branch: string; parent?: { full_name: string; default_branch: string; owner: { login: string } } }>(`/repos/${owner}/${name}`, token);
  if (!meta.fork || !meta.parent) return null;
  const { parent } = meta;
  // The combined diff from the original to the fork's head: its hunk line numbers match the files we index.
  const cmp = await gh<{ commits: { sha: string; author: { login: string } | null }[]; files?: { filename: string; status: string; patch?: string }[] }>(
    `/repos/${parent.full_name}/compare/${parent.default_branch}...${owner}:${meta.default_branch}`, token);
  const own = cmp.commits.filter((c) => c.author?.login !== parent.owner.login);
  const touched = new Set<string>();
  for (const c of own.slice(-100)) {
    const detail = await gh<{ files?: { filename: string; status: string }[] }>(`/repos/${owner}/${name}/commits/${c.sha}`, token);
    for (const f of detail.files ?? []) if (f.status !== "removed") touched.add(f.filename);
  }
  const work: ForkWork = new Map();
  for (const f of cmp.files ?? []) {
    if (!touched.has(f.filename) || f.status === "removed") continue;
    if (f.status === "added") work.set(f.filename, "all");
    else if (f.patch) work.set(f.filename, addedRanges(f.patch)); // no patch (huge diff): can't tell which lines — skip
  }
  return { parent: parent.full_name, commits: own.length, work };
}

async function downloadTarball(repoUrl: string, token: string) {
  const [owner, name] = ownerAndName(repoUrl);
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/tarball`, { headers: ghHeaders(token) });
  if (res.status === 401) throw new GithubAuthError();
  // The GitHub App was installed without Repository → Contents: Read. Public repos still download; private don't.
  if (res.status === 403 && /not accessible by integration/i.test(await res.clone().text())) {
    throw new Error("CommitCV's GitHub App can't read this repo's files yet. Give the app Contents: Read-only access, then press Sync.");
  }
  if (!res.ok || !res.body) throw new Error(res.status === 404 ? "GitHub has no files for this repository (it may be empty)." : `GitHub returned ${res.status} for the repository archive.`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_DOWNLOAD_BYTES) throw new Error("Repository archive is larger than 50 MB");
  return readTarball(res.body as unknown as AsyncIterable<Uint8Array>);
}

/** Index one claimed repo. Unchanged chunks keep their embeddings, so re-indexing after a push only
 * embeds what actually changed. */
export async function indexRepo(repo: typeof repos.$inferSelect, token: string): Promise<"ready" | "paused" | "failed"> {
  try {
    const fork = await forkChanges(repo.url, token);
    const all = await downloadTarball(repo.url, token);
    // A fork contributes only what its own commits added. Its manifests list the original's dependencies,
    // so a fork's dependencies count only from manifests the fork itself created.
    const files = fork ? all.files.filter((f) => fork.work.has(f.path)) : all.files;
    const paths = fork ? all.paths.filter((p) => fork.work.has(p)) : all.paths;
    const base = repoFacts(fork ? files.filter((f) => fork.work.get(f.path) === "all") : files, paths);
    const facts = fork ? { ...base, fork: { parent: fork.parent, commits: fork.commits, changedFiles: fork.work.size } } : base;
    const chunks = fork ? keepForkWork(chunkRepo(files), fork.work) : chunkRepo(files);

    const known = new Map(
      (await db.select({ contentHash: repoChunks.contentHash, embedding: repoChunks.embedding }).from(repoChunks).where(eq(repoChunks.repoId, repo.id)))
        .map((r) => [r.contentHash, r.embedding]),
    );
    const fresh = [...new Map(chunks.filter((c) => !known.has(c.contentHash)).map((c) => [c.contentHash, c])).values()];
    const vectors = await embedDocuments(fresh.map(embeddingInput));
    fresh.forEach((c, i) => known.set(c.contentHash, vectors[i]));

    await db.transaction(async (tx) => {
      await tx.delete(repoChunks).where(eq(repoChunks.repoId, repo.id));
      for (let i = 0; i < chunks.length; i += 200) {
        await tx.insert(repoChunks).values(chunks.slice(i, i + 200).map((c) => ({
          ...c, repoId: repo.id, embedding: known.get(c.contentHash)!,
          tsv: sql`to_tsvector('simple', ${searchText(c)})` as unknown as string,
        })));
      }
      await tx.update(repos)
        .set({ indexStatus: "ready", indexedPushedAt: repo.pushedAt, indexedAt: new Date(), indexError: null, facts })
        .where(eq(repos.id, repo.id));
    });
    return "ready";
  } catch (e) {
    // Out of free allowance, or the user's GitHub access lapsed: nothing is wrong with the repo itself.
    if (e instanceof CapacityError || e instanceof GithubAuthError) {
      await db.update(repos).set({ indexStatus: "pending" }).where(eq(repos.id, repo.id));
      if (e instanceof GithubAuthError) throw e;
      return "paused";
    }
    console.error("indexRepo failed", repo.id, e);
    await db.update(repos)
      .set({ indexStatus: "failed", indexedPushedAt: repo.pushedAt, indexError: (e instanceof Error ? e.message : String(e)).slice(0, 300) })
      .where(eq(repos.id, repo.id));
    return "failed";
  }
}

/** Index the next repo for one user. Called repeatedly by the Projects page while repos are left. */
export async function indexNextForUser(userId: string, token: string) {
  const repo = await claimNextRepo(eq(repos.userId, userId));
  const outcome = repo ? await indexRepo(repo, token) : "idle";
  return { outcome, repo: repo?.name ?? null, remaining: outcome === "paused" ? 0 : await reposLeftToIndex(userId) };
}
