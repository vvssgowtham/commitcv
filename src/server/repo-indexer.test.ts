import { gzipSync } from "node:zlib";
import { Header } from "tar";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

const embedded: string[][] = [];
let embedFails: Error | null = null;
vi.mock("@/server/services/embeddings", () => ({
  embedDocuments: async (texts: string[]) => {
    if (embedFails) throw embedFails;
    embedded.push(texts);
    return texts.map(() => Array.from({ length: 1024 }, () => 0.01));
  },
}));

function tarball(files: Record<string, string>) {
  const blocks: Buffer[] = [];
  for (const [path, text] of Object.entries(files)) {
    const body = Buffer.from(text);
    const block = Buffer.alloc(512);
    new Header({ path: `me-repo-sha/${path}`, size: body.length, type: "File", mode: 0o644, mtime: new Date(0) }).encode(block);
    blocks.push(block, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
let archive: Record<string, string> = {};
// GitHub as the indexer sees it: repo metadata, then the archive. `forkOf` turns the test repo into a fork.
let forkOf: null | { commits: { sha: string; login: string; files: string[] }[]; diff: { filename: string; status: string; patch?: string }[] } = null;
const github = (url: string) => {
  const path = new URL(url).pathname;
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  if (path.endsWith("/tarball")) return new Response(tarball(archive));
  if (/^\/repos\/me\/r\d+$/.test(path)) return json(forkOf ? { fork: true, default_branch: "main", parent: { full_name: "upstream/r", default_branch: "main", owner: { login: "upstream" } } } : { fork: false, default_branch: "main" });
  if (path.includes("/compare/")) return json({ commits: forkOf!.commits.map((c) => ({ sha: c.sha, author: { login: c.login } })), files: forkOf!.diff });
  const sha = path.match(/\/commits\/(\w+)$/)?.[1];
  if (sha) return json({ files: forkOf!.commits.find((c) => c.sha === sha)!.files.map((filename) => ({ filename, status: "modified" })) });
  return new Response("not found", { status: 404 });
};

describe.skipIf(!url)("repo indexer", () => {
  let db: typeof import("@/db").db;
  let s: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");
  let ix: typeof import("./repo-indexer");
  let repos: typeof import("./repos");
  let userId = "";
  let otherUserId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    s = await import("@/db/schema");
    orm = await import("drizzle-orm");
    ix = await import("./repo-indexer");
    repos = await import("./repos");
    const [u, o] = await db.insert(s.users).values([
      { name: "I", email: `i-${crypto.randomUUID()}@example.com` },
      { name: "O", email: `o-${crypto.randomUUID()}@example.com` },
    ]).returning();
    userId = u.id;
    otherUserId = o.id;
  });
  afterAll(async () => { await db.delete(s.users).where(orm.inArray(s.users.id, [userId, otherUserId])); });
  beforeEach(async () => {
    embedded.length = 0;
    embedFails = null;
    archive = {
      "README.md": "# Payments\nA service that takes card payments through Razorpay webhooks.",
      "package.json": JSON.stringify({ dependencies: { fastify: "4", razorpay: "2" } }),
      "Dockerfile": "FROM node:22",
      "src/pay.ts": "export function verifyRazorpaySignature(body: string) {\n  return hmac(body);\n}",
      "src/util.ts": "export const sum = (a: number, b: number) => a + b; // a helper long enough",
    };
    forkOf = null;
    vi.stubGlobal("fetch", vi.fn(async (u: string) => github(u)));
    await db.delete(s.githubRepositories).where(orm.inArray(s.githubRepositories.userId, [userId, otherUserId]));
  });
  afterEach(() => vi.unstubAllGlobals());

  const addRepo = async (owner = userId, id = 1) =>
    (await db.insert(s.githubRepositories).values({ userId: owner, githubRepoId: id, name: `r${id}`, url: `https://github.com/me/r${id}`, pushedAt: new Date("2026-01-01") }).returning())[0];
  // Always scoped to the test user: an unscoped claim would pick up any other repo in the database.
  const mine = () => ix.claimNextRepo(orm.eq(s.githubRepositories.userId, userId));
  const chunksOf = (repoId: string) => db.select().from(s.repoChunks).where(orm.eq(s.repoChunks.repoId, repoId));
  const repoRow = async (id: string) => (await db.select().from(s.githubRepositories).where(orm.eq(s.githubRepositories.id, id)))[0];

  test("indexes a repo: chunks, exact facts, ready status", async () => {
    const repo = await addRepo();
    const claimed = (await mine())!;
    expect(claimed.id).toBe(repo.id);
    expect(await ix.indexRepo(claimed, "token")).toBe("ready");
    const row = await repoRow(repo.id);
    expect(row).toMatchObject({ indexStatus: "ready", indexError: null, facts: { dependencies: ["fastify", "razorpay"], infra: ["Docker"], files: 5, hasTests: false } });
    expect(row.indexedPushedAt).toEqual(repo.pushedAt);
    expect((await chunksOf(repo.id)).map((c) => c.path).sort()).toEqual(["README.md", "src/pay.ts", "src/util.ts"]);
    // Full-text side finds the split identifier.
    const hits = await db.select({ path: s.repoChunks.path }).from(s.repoChunks)
      .where(orm.and(orm.eq(s.repoChunks.repoId, repo.id), orm.sql`${s.repoChunks.tsv} @@ plainto_tsquery('simple', 'razorpay signature')`));
    expect(hits.map((h) => h.path)).toContain("src/pay.ts");
    expect(await mine()).toBeNull(); // nothing left
  });

  test("after a push, only changed chunks are embedded again", async () => {
    const repo = await addRepo();
    await ix.indexRepo((await mine())!, "t");
    const first = embedded.flat().length;
    archive["src/util.ts"] = "export const sum = (a: number, b: number) => a + b + 0; // changed helper text";
    await db.update(s.githubRepositories).set({ pushedAt: new Date("2026-02-01") }).where(orm.eq(s.githubRepositories.id, repo.id));
    await ix.indexRepo((await mine())!, "t");
    expect(first).toBe(3);
    expect(embedded.at(-1)).toHaveLength(1);
    expect(embedded.at(-1)![0]).toContain("changed helper");
    expect(await chunksOf(repo.id)).toHaveLength(3);
  });

  test("a fork contributes only the files its own commits changed, never the original's code", async () => {
    const repo = await addRepo();
    // A long file the original wrote, where the fork changed two lines near the end.
    archive["src/big.ts"] = Array.from({ length: 120 }, (_, i) => (i % 40 === 0 ? `export function f${i}() {` : `  const line${i} = ${i}; // original code`)).join("\n");
    forkOf = {
      commits: [
        { sha: "a1", login: "upstream", files: ["src/pay.ts"] },   // the original author's commit: not the user's work
        { sha: "b2", login: "the-user", files: ["Dockerfile", "src/big.ts"] },
      ],
      diff: [
        { filename: "src/pay.ts", status: "modified", patch: "@@ -1,2 +1,3 @@\n x\n+y" },
        { filename: "src/big.ts", status: "modified", patch: "@@ -100,2 +100,2 @@\n-a\n-b\n+c\n+d" },
        { filename: "Dockerfile", status: "added", patch: "@@ -0,0 +1 @@\n+FROM node:22" },
      ],
    };
    expect(await ix.indexRepo((await mine())!, "t")).toBe("ready");
    const kept = await chunksOf(repo.id);
    expect(kept.map((c) => c.path)).toEqual(["src/big.ts"]); // not README.md, not src/pay.ts, not untouched files
    expect(kept.every((c) => c.startLine <= 101 && c.endLine >= 100)).toBe(true); // only the chunk holding the change
    expect((await repoRow(repo.id)).facts).toEqual({ dependencies: [], infra: ["Docker"], files: 2, hasTests: false, fork: { parent: "upstream/r", commits: 1, changedFiles: 2 } });
  });

  test("two concurrent claims never get the same repo", async () => {
    await addRepo();
    const [a, b] = await Promise.all([mine(), mine()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  test("a failed repo waits for new commits instead of retrying forever", async () => {
    const repo = await addRepo();
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (String(u).endsWith("/tarball") ? new Response("nope", { status: 500 }) : github(u))));
    expect(await ix.indexRepo((await mine())!, "t")).toBe("failed");
    expect(await repoRow(repo.id)).toMatchObject({ indexStatus: "failed", indexError: expect.stringContaining("500") });
    expect(await mine()).toBeNull();
    await db.update(s.githubRepositories).set({ pushedAt: new Date("2026-03-01") }).where(orm.eq(s.githubRepositories.id, repo.id));
    expect((await mine())?.id).toBe(repo.id);
  });

  test("a private repo the app can't read says how to fix it, and Sync retries it", async () => {
    const repo = await addRepo();
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (String(u).endsWith("/tarball") ? new Response('{"message":"Resource not accessible by integration"}', { status: 403 }) : github(u))));
    expect(await ix.indexRepo((await mine())!, "t")).toBe("failed");
    expect((await repoRow(repo.id)).indexError).toMatch(/Contents: Read-only/);
    await repos.saveSyncedRepos(userId, [{ githubRepoId: 1, name: "r1", url: "https://github.com/me/r1", description: null, languages: {}, topics: [], readmeExcerpt: null, stars: 0, isPrivate: true, pushedAt: new Date("2026-01-01") }]);
    expect(await repoRow(repo.id)).toMatchObject({ indexStatus: "pending", indexError: null });
  });

  test("running out of free allowance pauses: back to pending, nothing written", async () => {
    const repo = await addRepo();
    const { CapacityError } = await import("@/server/services/llm");
    embedFails = new CapacityError("spent");
    expect(await ix.indexRepo((await mine())!, "t")).toBe("paused");
    expect((await repoRow(repo.id)).indexStatus).toBe("pending");
    expect(await chunksOf(repo.id)).toHaveLength(0);
  });

  test("excluding a repo deletes its chunks; including it again re-indexes", async () => {
    const repo = await addRepo();
    await ix.indexRepo((await mine())!, "t");
    expect(await repos.setRepoIncluded(userId, repo.id, false)).toBe(true);
    expect(await chunksOf(repo.id)).toHaveLength(0);
    expect(await mine()).toBeNull(); // excluded repos are never indexed
    await repos.setRepoIncluded(userId, repo.id, true);
    expect((await mine())?.id).toBe(repo.id);
  });

  test("a user's claim never picks another user's repo", async () => {
    await addRepo(otherUserId, 2);
    expect(await ix.claimNextRepo(orm.eq(s.githubRepositories.userId, userId))).toBeNull();
    expect(await ix.reposLeftToIndex(userId)).toBe(0);
    expect(await ix.reposLeftToIndex(otherUserId)).toBe(1);
  });
});
