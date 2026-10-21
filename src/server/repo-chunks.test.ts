import { afterAll, beforeAll, describe, expect, test } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("repo_chunks storage", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");
  let userId = "";
  let repoId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
    const [u] = await db.insert(schema.users).values({ name: "C", email: `c-${crypto.randomUUID()}@example.com` }).returning();
    userId = u.id;
    const [r] = await db.insert(schema.githubRepositories).values({ userId, githubRepoId: 1, name: "r", url: "https://github.com/me/r" }).returning();
    repoId = r.id;
  });
  afterAll(async () => { if (userId) await db.delete(schema.users).where(orm.eq(schema.users.id, userId)); });

  const vec = (hot: number) => Array.from({ length: 1024 }, (_, i) => (i === hot ? 1 : 0.01));
  const chunk = (path: string, hot: number) => ({
    repoId, path, startLine: 1, endLine: 2, kind: "code" as const, text: path, contentHash: path,
    embedding: vec(hot), tsv: orm.sql`to_tsvector('simple', ${path})` as unknown as string,
  });

  test("stores halfvec embeddings and orders by cosine distance", async () => {
    await db.insert(schema.repoChunks).values([chunk("payments.ts", 0), chunk("timeline.ts", 1), chunk("readme.md", 2)]);
    const rows = await db.select({ path: schema.repoChunks.path }).from(schema.repoChunks)
      .where(orm.eq(schema.repoChunks.repoId, repoId))
      .orderBy(orm.cosineDistance(schema.repoChunks.embedding, vec(1)));
    expect(rows.map((r) => r.path)).toEqual(["timeline.ts", expect.any(String), expect.any(String)]);
    const [stored] = await db.select({ e: schema.repoChunks.embedding }).from(schema.repoChunks).where(orm.eq(schema.repoChunks.path, "timeline.ts"));
    expect(stored.e).toHaveLength(1024);
  });

  test("deleting the repo deletes its chunks", async () => {
    await db.delete(schema.githubRepositories).where(orm.eq(schema.githubRepositories.id, repoId));
    expect(await db.select().from(schema.repoChunks).where(orm.eq(schema.repoChunks.repoId, repoId))).toHaveLength(0);
  });
});
