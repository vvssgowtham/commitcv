import "server-only";
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_SLUG: z.string().min(1), // github.com/apps/<slug>
    // Which LLM calls Claude/Grok/etc; only that provider's key is required.
    LLM_PROVIDER: z.enum(["xai", "anthropic"]).default("xai"),
    LLM_MODEL: z.string().min(1).default("grok-4.7"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    XAI_API_KEY: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
  })
  .check((ctx) => {
    const key = ctx.value.LLM_PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "XAI_API_KEY";
    if (!ctx.value[key]) ctx.issues.push({ code: "custom", message: `${key} is required when LLM_PROVIDER=${ctx.value.LLM_PROVIDER}`, path: [key], input: ctx.value });
  });

let cached: z.infer<typeof schema> | undefined;

// Validated on first use, not at import, so `next build` works without production secrets.
export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  return (cached = parsed.data);
}
