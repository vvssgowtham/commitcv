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

  test("requests are also capped by characters", async () => {
    const { batches } = await import("./embeddings");
    expect(batches(Array.from({ length: 10 }, () => "x".repeat(5000))).map((b) => b.length)).toEqual([3, 3, 3, 1]);
    expect(batches(["x".repeat(40_000), "y"]).map((b) => b.length)).toEqual([1, 1]); // a huge input goes alone
  });

  test("an 'input too big' rejection splits the request, then truncates a single oversized input", async () => {
    const { embedDocuments } = await import("./embeddings");
    const big = new APICallError({ message: "Bad Request", url: "u", requestBodyValues: {}, statusCode: 400, isRetryable: false,
      responseBody: '{"errors":[{"message":"AiError: AiError: input too big","code":3030}]}' });
    // Reject any request over 2 inputs, and any single input over 1,000 chars.
    embedMany.mockImplementation(async ({ values }: { values: string[] }) => {
      if (values.length > 2 || values.some((v) => v.length > 1000)) throw big;
      return { embeddings: values.map((v) => [v.length]) };
    });
    const out = await embedDocuments(["a".repeat(600), "b".repeat(600), "c".repeat(600), "d".repeat(600), "e".repeat(3000)]);
    expect(out).toEqual([[600], [600], [600], [600], [750]]); // order kept; the 3,000-char input embedded as its first 750
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
