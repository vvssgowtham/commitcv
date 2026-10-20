import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "@/env";

export const MODEL = "claude-opus-5-5";

/** A failure the user can act on; the message is safe to show. */
export class LlmError extends Error {}

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY }));

type Content = Anthropic.Beta.BetaContentBlockParam[];

/** One structured-output call. Inputs (resumes, job posts) are untrusted data; the system prompt says so. */
export async function structured<S extends z.ZodType>(schema: S, { system, content, effort = "medium" }: { system: string; content: Content; effort?: "low" | "medium" | "high" }): Promise<z.infer<S>> {
  let res;
  try {
    res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // On a policy decline the API retries on its default fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      throw new LlmError("Our AI provider is busy right now. Please try again in a minute.");
    }
    throw e;
  }
  if (res.stop_reason === "refusal") throw new LlmError("This document couldn't be processed. Try a different file.");
  if (res.stop_reason === "max_tokens") throw new LlmError("This document is too long to process.");
  if (!res.parsed_output) throw new LlmError("Couldn't read the result. Please try again.");
  return res.parsed_output as z.infer<S>;
}
