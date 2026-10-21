import { afterAll, beforeAll, describe, expect, test } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("AI capacity gate", () => {
  let llm: typeof import("./llm");
  let db: typeof import("@/db").db;
  let aiUsageDaily: typeof import("@/db/schema").aiUsageDaily;
  let eq: typeof import("drizzle-orm").eq;
  const day = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    ({ aiUsageDaily } = await import("@/db/schema"));
    ({ eq } = await import("drizzle-orm"));
    llm = await import("./llm");
    await db.delete(aiUsageDaily).where(eq(aiUsageDaily.day, day));
  });
  afterAll(async () => { await db.delete(aiUsageDaily).where(eq(aiUsageDaily.day, day)); });

  test("concurrent usage writes add up exactly", async () => {
    await Promise.all(Array.from({ length: 25 }, () => llm.recordUsage({ inputTokens: 100, outputTokens: 20 } as never)));
    const [row] = await db.select().from(aiUsageDaily).where(eq(aiUsageDaily.day, day));
    expect(row).toMatchObject({ tokens: 3000, requests: 25 });
    await expect(llm.checkCapacity()).resolves.toBeUndefined();
  });

  test("the gate trips at 90% of the daily token limit", async () => {
    await llm.recordUsage({ inputTokens: 180_000 - 3000, outputTokens: 0 } as never);
    await expect(llm.checkCapacity()).rejects.toThrow(/today's free AI capacity/);
  });
});
