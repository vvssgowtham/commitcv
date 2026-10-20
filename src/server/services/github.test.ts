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

  test("one repo's languages/README failing (e.g. 403) doesn't take down the rest of the sync", async () => {
    const fake: typeof fetch = async (input) => {
      const path = String(input).replace("https://api.github.com", "");
      if (path.startsWith("/user/installations?")) return json({ installations: [{ id: 7 }] });
      if (path.startsWith("/user/installations/7/repositories")) return json({ repositories: [
        { id: 1, name: "a", full_name: "me/a", html_url: "https://github.com/me/a", description: null, stargazers_count: 0, private: true, pushed_at: null, fork: false },
        { id: 2, name: "b", full_name: "me/b", html_url: "https://github.com/me/b", description: null, stargazers_count: 5, private: false, pushed_at: null, topics: [], fork: false },
      ] });
      if (path === "/repos/me/a/readme") return new Response("Forbidden", { status: 403 }); // the reported bug
      if (path === "/repos/me/a/languages") return json({ Go: 100 });
      if (path === "/repos/me/b/languages") return json({ TS: 100 });
      if (path === "/repos/me/b/readme") return new Response("# b", { status: 200 });
      return json({}, 404);
    };
    const repos = await fetchGrantedRepos("t", fake);
    expect(repos).toHaveLength(2); // repo "a" still comes through despite the readme 403
    expect(repos.find((r) => r.name === "a")).toMatchObject({ languages: { Go: 100 }, readmeExcerpt: null });
    expect(repos.find((r) => r.name === "b")).toMatchObject({ readmeExcerpt: "# b" });
  });

  test("an auth error from a per-repo call still aborts the whole sync, unlike other errors", async () => {
    const fake: typeof fetch = async (input) => {
      const path = String(input).replace("https://api.github.com", "");
      if (path.startsWith("/user/installations?")) return json({ installations: [{ id: 7 }] });
      if (path.startsWith("/user/installations/7/repositories")) return json({ repositories: [
        { id: 1, name: "a", full_name: "me/a", html_url: "https://github.com/me/a", description: null, stargazers_count: 0, private: false, pushed_at: null, fork: false },
      ] });
      return json({}, 401); // token expired partway through
    };
    await expect(fetchGrantedRepos("t", fake)).rejects.toBeInstanceOf(GithubAuthError);
  });

  test("a non-404/401 error includes GitHub's response body, not just the status code", async () => {
    const fake: typeof fetch = async () => new Response(JSON.stringify({ message: "Resource not accessible by integration" }), { status: 403 });
    await expect(fetchGrantedRepos("t", fake)).rejects.toThrow(/Resource not accessible by integration/);
  });
});

test("toPercent drops <1% and handles empty repos", () => {
  expect(toPercent({ TS: 996, CSS: 4 })).toEqual({ TS: 100 });
  expect(toPercent({})).toEqual({});
});
