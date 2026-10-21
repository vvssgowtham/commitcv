import "server-only";
import { groq } from "@ai-sdk/groq";
import { and, eq, sql } from "drizzle-orm";
import { APICallError, generateObject, NoObjectGeneratedError, RetryError, type FlexibleSchema, type LanguageModelUsage } from "ai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import type { z } from "zod";
import { db } from "@/db";
import { aiUsageDaily } from "@/db/schema";
import { env } from "@/env";

/** A failure the user can act on; the message is safe to show. */
export class LlmError extends Error {}
/** Today's shared free allowance for a provider is (nearly) used up. Background work waits for the reset. */
export class CapacityError extends LlmError {}

// Verified available to a Groq key and tested end-to-end with a live structured-output call.
const MODEL = "openai/gpt-oss-120b";

// groq() reads GROQ_API_KEY from process.env itself; call env() anyway so a missing key fails
// here with a clear message, not deeper inside the SDK.
function model() {
  env();
  return groq(MODEL);
}

// Free-tier allowances, shared by every user of the app. Raise these when moving to a paid tier.
// Groq gpt-oss-120b: console.groq.com/docs/rate-limits. Workers AI: 10k Neurons/day, and qwen3-embedding
// costs 1,075 Neurons per million tokens (developers.cloudflare.com/workers-ai/platform/pricing).
const LIMITS = {
  groq: { tokens: 200_000, requests: 1_000 },
  "workers-ai": { tokens: Math.floor((10_000 / 1_075) * 1_000_000), requests: Number.MAX_SAFE_INTEGER },
};
export type AiProvider = keyof typeof LIMITS;
// Our UTC day and token counts are estimates of the provider's own window, so stop a little early.
const HEADROOM = 0.9;
const today = () => new Date().toISOString().slice(0, 10);
const CAPACITY_MESSAGE = "CommitCV has used today's free AI capacity. Everything you've saved is safe — please come back tomorrow.";

/** Throws a user-facing LlmError once today's shared free AI capacity is (nearly) used up. */
export async function checkCapacity(provider: AiProvider = "groq") {
  const [row] = await db.select().from(aiUsageDaily).where(and(eq(aiUsageDaily.day, today()), eq(aiUsageDaily.provider, provider)));
  const limit = LIMITS[provider];
  if (row && (row.tokens >= limit.tokens * HEADROOM || row.requests >= limit.requests * HEADROOM)) {
    throw new CapacityError(CAPACITY_MESSAGE);
  }
}

export async function recordTokens(provider: AiProvider, tokens: number) {
  await db.insert(aiUsageDaily).values({ day: today(), provider, tokens, requests: 1 })
    .onConflictDoUpdate({ target: [aiUsageDaily.day, aiUsageDaily.provider], set: { tokens: sql`${aiUsageDaily.tokens} + ${tokens}`, requests: sql`${aiUsageDaily.requests} + 1` } });
}

export const recordUsage = (usage: LanguageModelUsage | undefined) =>
  recordTokens("groq", (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0));

// A failed usage write must not throw away a result the user already waited for.
const record = (usage: LanguageModelUsage | undefined) => recordUsage(usage).catch((e) => console.error("recordUsage failed", e));

const effortOptions = (effort: "low" | "medium" | "high"): SharedV4ProviderOptions => ({ groq: { reasoningEffort: effort } });

// Left unset, the provider applies its own (sometimes low) default and silently truncates a large
// structured response instead of erroring — a dense resume or job analysis can need more than that
// default leaves room for, especially once reasoning tokens are subtracted from the same budget.
const MAX_OUTPUT_TOKENS = 16000;

/**
 * One structured-output call, same shape regardless of provider.
 * Inputs (resumes, job posts) are untrusted data; the system prompt says so.
 */
export async function structured<S extends z.ZodType>(schema: S, { system, prompt, effort = "low" }: { system: string; prompt: string; effort?: "low" | "medium" | "high" }): Promise<z.infer<S>> {
  await checkCapacity();
  try {
    // Cast needed at this boundary: generateObject's own generics can't re-derive z.infer<S> through
    // our already-generic S, so we pin its output type directly to what `structured` promises callers.
    const { object, usage } = await generateObject({
      model: model(), output: "object", schema: schema as FlexibleSchema<z.infer<S>>, system, prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS, providerOptions: effortOptions(effort),
    });
    await record(usage);
    return object;
  } catch (caught) {
    // After the SDK's own retries (which already wait out Groq's retry-after), the real error is wrapped.
    const e = RetryError.isInstance(caught) ? caught.lastError : caught;
    if (NoObjectGeneratedError.isInstance(e)) {
      await record(e.usage); // tokens were spent even though the output was unusable
      throw new LlmError("Couldn't read the result. Please try again.");
    }
    if (APICallError.isInstance(e)) {
      if (e.statusCode === 401 || e.statusCode === 403) throw new LlmError("The AI provider rejected our API key. Check GROQ_API_KEY.");
      if (e.statusCode === 413) throw new LlmError("That's more than our AI provider accepts in one go right now. Please try again in a minute — if it keeps happening, shorten the text.");
      const providerMessage = String((e.data as { error?: { message?: string } } | undefined)?.error?.message ?? "");
      if (e.statusCode === 429 && /per day|TPD|RPD/i.test(providerMessage)) throw new CapacityError(CAPACITY_MESSAGE);
      if (e.isRetryable || e.statusCode === 429) throw new LlmError("Our AI provider is busy right now. Please try again in a minute.");
      if (e.data && typeof e.data === "object" && "error" in e.data) {
        const msg = String((e.data as { error?: { message?: string } }).error?.message ?? "");
        if (/max.?completion.?tokens|max.?output.?tokens|truncated/i.test(msg)) {
          throw new LlmError("That document is large enough that the AI's response got cut off. Please try again or shorten it.");
        }
      }
    }
    throw e;
  }
}
