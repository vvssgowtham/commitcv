import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

// No database here: usage is captured instead of written, and today's usage is always zero.
const recorded: number[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({ values: (v: { tokens: number }) => ({ onConflictDoUpdate: async () => { recorded.push(v.tokens); } }) }),
  },
}));
vi.mock("@/env", () => ({ env: () => ({}) }));
const generateObject = vi.fn();
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateObject: (...a: unknown[]) => generateObject(...a) }));

const apiError = (statusCode: number, message: string) => new APICallError({
  message, url: "https://api.groq.com", requestBodyValues: {}, statusCode, isRetryable: statusCode === 429,
  data: { error: { message } },
});
const call = async () => (await import("./llm")).structured(z.object({ a: z.string() }), { system: "s", prompt: "p" });

describe("structured() error mapping", () => {
  beforeEach(() => { recorded.length = 0; generateObject.mockReset(); });

  test("records real token usage on success", async () => {
    generateObject.mockResolvedValueOnce({ object: { a: "x" }, usage: { inputTokens: 120, outputTokens: 30 } });
    await expect(call()).resolves.toEqual({ a: "x" });
    expect(recorded).toEqual([150]);
  });

  test("a 429 that outlasted the SDK's own retries reads as 'busy', not a generic failure", async () => {
    generateObject.mockRejectedValueOnce(new RetryError({ message: "x", reason: "maxRetriesExceeded", errors: [apiError(429, "Rate limit reached on tokens per minute (TPM)")] }));
    await expect(call()).rejects.toThrow(/busy right now/);
  });

  test("Groq's per-day limit reads as the app's capacity message", async () => {
    generateObject.mockRejectedValueOnce(apiError(429, "Rate limit reached for model on tokens per day (TPD): Limit 200000"));
    await expect(call()).rejects.toThrow(/today's free AI capacity/);
  });

  test("an unusable result still records the tokens it spent", async () => {
    generateObject.mockRejectedValueOnce(new NoObjectGeneratedError({ message: "x", text: "", response: { id: "1", timestamp: new Date(), modelId: "m" }, usage: { inputTokens: 500, outputTokens: 100 } as never, finishReason: "stop" }));
    await expect(call()).rejects.toThrow(/Couldn't read the result/);
    expect(recorded).toEqual([600]);
  });
});
