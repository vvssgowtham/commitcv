import "server-only";
import { xai } from "@ai-sdk/xai";
import { APICallError, generateObject, NoObjectGeneratedError, type FlexibleSchema } from "ai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import type { z } from "zod";
import { env } from "@/env";

/** A failure the user can act on; the message is safe to show. */
export class LlmError extends Error {}

const model = () => xai(env().LLM_MODEL);

const effortOptions = (effort: "low" | "medium" | "high"): SharedV4ProviderOptions => ({ xai: { reasoningEffort: effort } });

/**
 * One structured-output call, same shape regardless of provider.
 * Inputs (resumes, job posts) are untrusted data; the system prompt says so.
 */
export async function structured<S extends z.ZodType>(schema: S, { system, prompt, effort = "medium" }: { system: string; prompt: string; effort?: "low" | "medium" | "high" }): Promise<z.infer<S>> {
  try {
    // Cast needed at this boundary: generateObject's own generics can't re-derive z.infer<S> through
    // our already-generic S, so we pin its output type directly to what `structured` promises callers.
    const { object } = await generateObject({ model: model(), output: "object", schema: schema as FlexibleSchema<z.infer<S>>, system, prompt, providerOptions: effortOptions(effort) });
    return object;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new LlmError("Couldn't read the result. Please try again.");
    if (APICallError.isInstance(e) && (e.isRetryable || e.statusCode === 429)) {
      throw new LlmError("Our AI provider is busy right now. Please try again in a minute.");
    }
    throw e;
  }
}
