import { describe, expect, test } from "vitest";

// Integration: needs a migrated Postgres. `TEST_DATABASE_URL=postgres://... npm test`
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("auth", () => {
  test("creating a user also creates their empty profile", async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
    const { auth } = await import("@/auth");
    const { db } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { candidateProfiles, users } = await import("@/db/schema");

    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({ name: "Test User", email: `t-${crypto.randomUUID()}@example.com` }, { method: "admin" });
    try {
      const profile = await db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.userId, user.id) });
      expect(profile).toMatchObject({ userId: user.id, links: [] });
    } finally {
      await db.delete(users).where(eq(users.id, user.id));
    }
  });
});
