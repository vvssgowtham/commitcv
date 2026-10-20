import "server-only";
import { groq } from "@ai-sdk/groq";
import { APICallError, generateObject, NoObjectGeneratedError, type FlexibleSchema } from "ai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import type { z } from "zod";
import { env } from "@/env";

/** A failure the user can act on; the message is safe to show. */
export class LlmError extends Error {}

// Verified available to a Groq key and tested end-to-end with a live structured-output call.
const MODEL = "openai/gpt-oss-120b";

// groq() reads GROQ_API_KEY from process.env itself; call env() anyway so a missing key fails
// here with a clear message, not deeper inside the SDK.
function model() {
  env();
  return groq(MODEL);
}

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
  try {
    // Cast needed at this boundary: generateObject's own generics can't re-derive z.infer<S> through
    // our already-generic S, so we pin its output type directly to what `structured` promises callers.
    const { object } = await generateObject({
      model: model(), output: "object", schema: schema as FlexibleSchema<z.infer<S>>, system, prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS, providerOptions: effortOptions(effort),
    });
    return object;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new LlmError("Couldn't read the result. Please try again.");
    if (APICallError.isInstance(e)) {
      if (e.statusCode === 401 || e.statusCode === 403) throw new LlmError("The AI provider rejected our API key. Check GROQ_API_KEY.");
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
