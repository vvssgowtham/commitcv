import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const BASE = {
  DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "x", GITHUB_CLIENT_SECRET: "x", GITHUB_APP_SLUG: "x",
  R2_ACCOUNT_ID: "x", R2_ACCESS_KEY_ID: "x", R2_SECRET_ACCESS_KEY: "x", R2_BUCKET: "x", CLOUDFLARE_AI_TOKEN: "x",
};

describe("env", () => {
  const original = { ...process.env };
  // env() caches its result at module scope; reset the registry so each test gets a fresh cache.
  beforeEach(() => {
    Object.assign(process.env, BASE);
    delete process.env.GROQ_API_KEY;
    vi.resetModules();
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  test("requires GROQ_API_KEY", async () => {
    const { env } = await import("./env");
    expect(() => env()).toThrow(/GROQ_API_KEY/);
    process.env.GROQ_API_KEY = "gsk_x";
    expect(() => env()).not.toThrow();
  });
});
