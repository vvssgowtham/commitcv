import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, embedMany, RetryError } from "ai";
import { env } from "@/env";
import { CapacityError, checkCapacity, LlmError, recordTokens } from "@/server/services/llm";

// Open model (Apache-2.0), MTEB Code 75.41 — ahead of Gemini Embedding and OpenAI's large model —
// served on Cloudflare Workers AI, which doesn't train on customer content.
const MODEL = "@cf/qwen/qwen3-embedding-0.6b";
export const EMBEDDING_DIMENSIONS = 1024;
// Measured: 100 inputs per request in ~2.3s. Workers AI also rejects a request whose total *tokens* pass an
// unpublished limit ("input too big", code 3030): 34 real chunks / 37k chars failed, 100 synthetic / 180k
// passed. So requests are capped by characters too, and a rejected request is split until it fits.
const BATCH = 100;
const BATCH_CHARS = 16_000;
const MIN_INPUT_CHARS = 500;

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

const tooBig = (e: unknown) => APICallError.isInstance(e) && e.statusCode === 400 && /3030|input too big/i.test(e.responseBody ?? "");

/** Consecutive groups of at most BATCH inputs and BATCH_CHARS characters (a lone huge input gets its own group). */
export function batches(texts: string[]) {
  const out: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const t of texts) {
    if (cur.length && (cur.length === BATCH || chars + t.length > BATCH_CHARS)) { out.push(cur); cur = []; chars = 0; }
    cur.push(t);
    chars += t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function embedBatch(batch: string[]): Promise<number[][]> {
  try {
    const { embeddings } = await embedMany({ model: model(), values: batch });
    await recordTokens("workers-ai", estimateTokens(batch));
    return embeddings;
  } catch (e) {
    if (!tooBig(e)) throw e;
    if (batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      return [...await embedBatch(batch.slice(0, mid)), ...await embedBatch(batch.slice(mid))];
    }
    // One input alone is too big: embed its first half (the start of a chunk carries its path and signature).
    if (batch[0].length / 2 < MIN_INPUT_CHARS) throw e;
    return embedBatch([batch[0].slice(0, Math.floor(batch[0].length / 2))]);
  }
}

async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  await checkCapacity("workers-ai");
  const out: number[][] = [];
  try {
    for (const batch of batches(texts)) out.push(...await embedBatch(batch));
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
