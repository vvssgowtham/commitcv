import { APICallError } from "ai";
import { beforeEach, describe, expect, test, vi } from "vitest";

const recorded: number[] = [];
vi.mock("@/server/services/llm", async (orig) => ({
  ...(await orig<typeof import("./llm")>()),
  checkCapacity: async () => {},
  recordTokens: async (_p: string, n: number) => { recorded.push(n); },
}));
vi.mock("@/env", () => ({ env: () => ({ R2_ACCOUNT_ID: "acc", CLOUDFLARE_AI_TOKEN: "tok" }) }));
const embedMany = vi.fn();
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), embedMany: (o: unknown) => embedMany(o) }));

const apiError = (statusCode: number) => new APICallError({ message: "x", url: "u", requestBodyValues: {}, statusCode, isRetryable: false });

describe("embeddings", () => {
  beforeEach(() => {
    recorded.length = 0;
    embedMany.mockReset();
    embedMany.mockImplementation(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [1, 0]) }));
  });

  test("splits into batches of 100, keeps order, records each batch's estimated tokens", async () => {
    const { embedDocuments } = await import("./embeddings");
    const out = await embedDocuments(Array.from({ length: 250 }, () => "abcdef"));
    expect(out).toHaveLength(250);
    expect(embedMany.mock.calls.map(([o]) => o.values.length)).toEqual([100, 100, 50]);
    expect(recorded).toEqual([200, 200, 100]); // 6 chars ≈ 2 tokens each, counted conservatively
  });

  test("queries get Qwen3's instruction, documents don't", async () => {
    const { embedDocuments, embedQueries } = await import("./embeddings");
    await embedDocuments(["doc"]);
    await embedQueries(["Kafka pipelines"]);
    expect(embedMany.mock.calls[0][0].values).toEqual(["doc"]);
    expect(embedMany.mock.calls[1][0].values[0]).toMatch(/^Instruct: [^\n]+\nQuery:Kafka pipelines$/);
  });

  test("a 429 (daily free Neurons spent) pauses as capacity; a bad token says so", async () => {
    const { embedDocuments } = await import("./embeddings");
    const { CapacityError } = await import("./llm");
    embedMany.mockRejectedValueOnce(apiError(429));
    await expect(embedDocuments(["x"])).rejects.toBeInstanceOf(CapacityError);
    embedMany.mockRejectedValueOnce(apiError(401));
    await expect(embedDocuments(["x"])).rejects.toThrow(/CLOUDFLARE_AI_TOKEN/);
  });
});
