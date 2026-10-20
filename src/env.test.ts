import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const BASE = {
  DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "x", GITHUB_CLIENT_SECRET: "x", GITHUB_APP_SLUG: "x",
  R2_ACCOUNT_ID: "x", R2_ACCESS_KEY_ID: "x", R2_SECRET_ACCESS_KEY: "x", R2_BUCKET: "x",
};

describe("env", () => {
  const original = { ...process.env };
  // env() caches its result at module scope; reset the registry so each test gets a fresh cache.
  // Mutate in place (not `process.env = {...}`) so ambient vars like NODE_ENV are left alone;
  // explicitly clear the two provider keys so a real one set in the shell can't leak into a test.
  beforeEach(() => {
    Object.assign(process.env, BASE);
    delete process.env.LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.XAI_API_KEY;
    vi.resetModules();
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  test("requires the key matching the active LLM_PROVIDER, not the other one", async () => {
    const { env } = await import("./env");
    process.env.LLM_PROVIDER = "xai"; // no XAI_API_KEY, but has an unrelated ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    expect(() => env()).toThrow(/XAI_API_KEY/);

    delete process.env.ANTHROPIC_API_KEY;
    process.env.XAI_API_KEY = "xai-x";
    expect(() => env()).not.toThrow();
  });

  test("defaults to xai with model grok-4.7 when unset", async () => {
    const { env } = await import("./env");
    process.env.XAI_API_KEY = "xai-x";
    const e = env();
    expect(e.LLM_PROVIDER).toBe("xai");
    expect(e.LLM_MODEL).toBe("grok-4.7");
  });

  test("anthropic provider requires ANTHROPIC_API_KEY instead", async () => {
    const { env } = await import("./env");
    process.env.LLM_PROVIDER = "anthropic";
    process.env.XAI_API_KEY = "xai-x"; // present but irrelevant
    expect(() => env()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
