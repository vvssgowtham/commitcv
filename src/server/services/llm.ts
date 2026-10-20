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

const POSTING_MAX_CHARS = 30_000;

/**
 * Fetch a job posting through Claude's web_fetch server tool (no request leaves our servers, so no SSRF surface).
 * Returns the page text exactly as fetched — never a model rewrite — or throws an LlmError asking for a paste.
 */
export async function fetchPostingText(url: string): Promise<string> {
  const pasteInstead = new LlmError("We couldn't read that page. Paste the job description instead.");
  let res;
  try {
    res = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 1, max_content_tokens: 20_000, allowed_callers: ["direct"] }],
      messages: [{ role: "user", content: `Fetch this job posting with web_fetch, then reply "done".\n${url}` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      throw new LlmError("Our AI provider is busy right now. Please try again in a minute.");
    }
    throw e;
  }
  for (const block of res.content) {
    if (block.type !== "web_fetch_tool_result" || block.content.type !== "web_fetch_result") continue;
    const source = block.content.content.source;
    if (source.type !== "text") throw pasteInstead; // e.g. a PDF posting
    const text = source.data.trim();
    if (text.length < 200) throw pasteInstead; // login walls and empty shells
    return text.slice(0, POSTING_MAX_CHARS);
  }
  throw pasteInstead;
}
