import { describe, expect, test } from "vitest";
import { fetchGrantedRepos, GithubAuthError, toPercent } from "./github";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("fetchGrantedRepos", () => {
  test("reads repos from the user's installations only, with languages and README", async () => {
    const calls: string[] = [];
    const fake: typeof fetch = async (input) => {
      const path = String(input).replace("https://api.github.com", "");
      calls.push(path);
      if (path.startsWith("/user/installations?")) return json({ installations: [{ id: 7 }] });
      if (path.startsWith("/user/installations/7/repositories")) return json({ repositories: [
        { id: 1, name: "a", full_name: "me/a", html_url: "https://github.com/me/a", description: "A", stargazers_count: 3, private: false, pushed_at: "2026-01-01T00:00:00Z", topics: ["cli"], fork: false },
      ] });
      if (path === "/repos/me/a/languages") return json({ Go: 900, Shell: 95, Makefile: 5 });
      if (path === "/repos/me/a/readme") return new Response("# a\nA tool", { status: 200 });
      return json({}, 404);
    };
    const [repo] = await fetchGrantedRepos("t", fake);
    expect(repo).toMatchObject({ githubRepoId: 1, name: "a", languages: { Go: 90, Shell: 10 }, topics: ["cli"], readmeExcerpt: "# a\nA tool", stars: 3 });
    expect(calls.some((c) => c.startsWith("/user/repos"))).toBe(false); // never lists beyond the grant
  });

  test("expired token surfaces as an auth error", async () => {
    await expect(fetchGrantedRepos("t", async () => json({}, 401))).rejects.toBeInstanceOf(GithubAuthError);
  });
});

test("toPercent drops <1% and handles empty repos", () => {
  expect(toPercent({ TS: 996, CSS: 4 })).toEqual({ TS: 100 });
  expect(toPercent({})).toEqual({});
});
