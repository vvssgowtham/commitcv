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
    vi.stubGlobal("fetch", vi.fn(async () => new Response(tarball(archive))));
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

  test("two concurrent claims never get the same repo", async () => {
    await addRepo();
    const [a, b] = await Promise.all([mine(), mine()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  test("a failed repo waits for new commits instead of retrying forever", async () => {
    const repo = await addRepo();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await ix.indexRepo((await mine())!, "t")).toBe("failed");
    expect(await repoRow(repo.id)).toMatchObject({ indexStatus: "failed", indexError: expect.stringContaining("500") });
    expect(await mine()).toBeNull();
    await db.update(s.githubRepositories).set({ pushedAt: new Date("2026-03-01") }).where(orm.eq(s.githubRepositories.id, repo.id));
    expect((await mine())?.id).toBe(repo.id);
  });

  test("a private repo the app can't read says how to fix it, and Sync retries it", async () => {
    const repo = await addRepo();
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"Resource not accessible by integration"}', { status: 403 })));
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
