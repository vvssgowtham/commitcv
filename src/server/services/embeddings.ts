import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, embedMany, RetryError } from "ai";
import { env } from "@/env";
import { CapacityError, checkCapacity, LlmError, recordTokens } from "@/server/services/llm";

// Open model (Apache-2.0), MTEB Code 75.41 — ahead of Gemini Embedding and OpenAI's large model —
// served on Cloudflare Workers AI, which doesn't train on customer content.
const MODEL = "@cf/qwen/qwen3-embedding-0.6b";
export const EMBEDDING_DIMENSIONS = 1024;
// Measured: 100 inputs per request in ~2.3s.
const BATCH = 100;

function model() {
  const { R2_ACCOUNT_ID, CLOUDFLARE_AI_TOKEN } = env(); // R2 and Workers AI share the Cloudflare account
  return createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/ai/v1`,
    apiKey: CLOUDFLARE_AI_TOKEN,
  }).embeddingModel(MODEL);
}

// Workers AI doesn't report usage, so count conservatively: code tokenizes at roughly 3 chars per token.
const estimateTokens = (texts: string[]) => Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 3);

// Qwen3 is instruction-aware on the query side only; its model card reports 1–5% better retrieval with it.
const QUERY_INSTRUCTION = "Instruct: Given a job requirement, retrieve code or documentation from a developer's repository that shows they built it\nQuery:";

async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  await checkCapacity("workers-ai");
  const out: number[][] = [];
  try {
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const { embeddings } = await embedMany({ model: model(), values: batch });
      await recordTokens("workers-ai", estimateTokens(batch));
      out.push(...embeddings);
    }
  } catch (caught) {
    if (caught instanceof CapacityError) throw caught;
    const e = RetryError.isInstance(caught) ? caught.lastError : caught;
    if (APICallError.isInstance(e)) {
      if (e.statusCode === 401 || e.statusCode === 403) throw new LlmError("Cloudflare rejected our API token. Check CLOUDFLARE_AI_TOKEN.");
      // Workers AI answers 429 once the account's daily free Neurons are spent.
      if (e.statusCode === 429) throw new CapacityError("Today's free indexing allowance is used up; indexing resumes tomorrow.");
    }
    throw e;
  }
  return out;
}

/** Embed repository content (README sections, code chunks). */
export const embedDocuments = (texts: string[]) => embed(texts);

/** Embed search queries (job requirements, a posting) with the instruction Qwen3 expects for queries. */
export const embedQueries = (texts: string[]) => embed(texts.map((t) => QUERY_INSTRUCTION + t));
