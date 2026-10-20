import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const BASE = {
  DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "x", GITHUB_CLIENT_SECRET: "x", GITHUB_APP_SLUG: "x",
  R2_ACCOUNT_ID: "x", R2_ACCESS_KEY_ID: "x", R2_SECRET_ACCESS_KEY: "x", R2_BUCKET: "x",
};

describe("env", () => {
  const original = { ...process.env };
  // env() caches its result at module scope; reset the registry so each test gets a fresh cache.
  beforeEach(() => {
    Object.assign(process.env, BASE);
    delete process.env.XAI_API_KEY;
    delete process.env.LLM_MODEL;
    vi.resetModules();
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  test("requires XAI_API_KEY", async () => {
    const { env } = await import("./env");
    expect(() => env()).toThrow(/XAI_API_KEY/);
    process.env.XAI_API_KEY = "xai-x";
    expect(() => env()).not.toThrow();
  });

  test("defaults LLM_MODEL to grok-4.7", async () => {
    const { env } = await import("./env");
    process.env.XAI_API_KEY = "xai-x";
    expect(env().LLM_MODEL).toBe("grok-4.7");
    process.env.LLM_MODEL = "grok-4.3";
    vi.resetModules();
    const { env: env2 } = await import("./env");
    expect(env2().LLM_MODEL).toBe("grok-4.3");
  });
});
