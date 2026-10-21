import { describe, expect, test, vi } from "vitest";

vi.mock("@/server/services/embeddings", () => ({ embedQueries: vi.fn() }));

describe("hybrid search helpers", () => {
  test("rank fusion favours chunks that several rankings agree on", async () => {
    const { fuse } = await import("./repo-search");
    const out = fuse([["a", "b", "c"], ["c", "a"], ["c"]]).map(([id]) => id);
    expect(out).toEqual(["c", "a", "b"]);
  });

  test("query terms: plain words only (nothing unescaped reaches to_tsquery), common words dropped", async () => {
    const { queryTerms } = await import("./repo-search");
    expect(queryTerms("Experience building with Kafka & Node.js; DROP TABLE x | !")).toEqual(["kafka", "node", "js", "drop", "table"]);
    expect(queryTerms("and with the code")).toEqual([]);
  });
});

describe("job-analysis repo listing", () => {
  const repo = (over: Record<string, unknown>) => ({
    id: crypto.randomUUID(), name: "r", description: "A thing", readmeExcerpt: null, languages: { TypeScript: 90, CSS: 10 }, topics: [],
    pushedAt: new Date("2026-05-01"), facts: { dependencies: ["fastify", "@types/node", "eslint"], infra: ["Docker"], files: 3, hasTests: true }, ...over,
  }) as never;

  test("one line per repo with short ids that map back; tooling noise left out", async () => {
    const { repoListing } = await import("./jobs");
    const a = repo({ name: "api" });
    const { text, alias } = repoListing([a, repo({ name: "web" })]);
    expect(text.split("\n")[0]).toBe("r1 | api | 2026-05 | TypeScript, CSS, Docker, fastify | A thing");
    expect(alias.get("r1")).toBe((a as { id: string }).id);
    expect(text).not.toMatch(/@types|eslint/);
  });

  test("a fork shows only tech from the user's own changes, never the original's languages or README", async () => {
    const { repoListing } = await import("./jobs");
    const { text } = repoListing([repo({ name: "crm", description: "Upstream's CRM", facts: { dependencies: [], infra: ["Docker Compose"], files: 4, hasTests: false, fork: { parent: "someone/crm", commits: 11, changedFiles: 4 } } })]);
    expect(text).toBe("r1 | crm | 2026-05 | Docker Compose | fork of someone/crm; only the candidate's own changes (11 commits) count");
  });
});
