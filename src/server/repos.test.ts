import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { GrantedRepo } from "./services/github";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("repo sync", () => {
  let userId = "";
  let mod: typeof import("./repos");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
    mod = await import("./repos");
    const [u] = await db.insert(schema.users).values({ name: "R", email: `r-${crypto.randomUUID()}@example.com` }).returning();
    userId = u.id;
  });
  afterAll(async () => { if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId)); });

  const repo = (id: number, over: Partial<GrantedRepo> = {}): GrantedRepo => ({
    githubRepoId: id, name: `r${id}`, url: `https://github.com/me/r${id}`, description: null, languages: { Go: 100 },
    topics: [], readmeExcerpt: null, stars: 0, isPrivate: false, pushedAt: null, ...over,
  });

  test("re-sync keeps the user's include choice, updates metadata, drops revoked repos", async () => {
    await mod.saveSyncedRepos(userId, [repo(1), repo(2)]);
    const [first] = (await mod.listRepos(userId)).filter((r) => r.githubRepoId === 1);
    expect(await mod.setRepoIncluded(userId, first.id, false)).toBe(true);

    await mod.saveSyncedRepos(userId, [repo(1, { stars: 9 })]); // repo 2 access revoked
    const after = await mod.listRepos(userId);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ githubRepoId: 1, stars: 9, included: false });
  });

  test("cannot toggle another user's repo", async () => {
    expect(await mod.setRepoIncluded(userId, crypto.randomUUID(), true)).toBe(false);
  });
});
