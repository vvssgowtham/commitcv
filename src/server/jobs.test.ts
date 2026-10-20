import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

// The model is stubbed to misbehave: it cites ids the user doesn't own and a repo they excluded.
vi.mock("@/server/services/llm", () => ({
  structured: vi.fn(),
  LlmError: class extends Error {},
}));

describe.skipIf(!url)("job analysis", () => {
  let userId = "";
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
    const [u] = await db.insert(schema.users).values({ name: "J", email: `j-${crypto.randomUUID()}@example.com` }).returning();
    userId = u.id;
  });
  afterAll(async () => { if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId)); });

  test("stores only evidence and repos the user owns and included", async () => {
    const { writeProfile, getProfile } = await import("./profile");
    const { saveSyncedRepos, listRepos, setRepoIncluded } = await import("./repos");
    const { structured } = await import("@/server/services/llm");
    const { analyzeAndSaveJob, getJob, listJobs } = await import("./jobs");

    const profile = await writeProfile(userId, { ...(await getProfile(userId)), skills: [{ id: "x", source: "MANUAL", skill: "Go", category: "Languages" }] }, "user");
    const go = profile.skills[0].id;
    const base = { name: "r", url: "https://github.com/me/r", description: null, languages: {}, topics: [], readmeExcerpt: null, stars: 0, isPrivate: false, pushedAt: null };
    await saveSyncedRepos(userId, [{ ...base, githubRepoId: 1, name: "kept" }, { ...base, githubRepoId: 2, name: "excluded" }]);
    const repos = await listRepos(userId);
    const kept = repos.find((r) => r.name === "kept")!;
    const excluded = repos.find((r) => r.name === "excluded")!;
    await setRepoIncluded(userId, excluded.id, false);

    vi.mocked(structured).mockResolvedValueOnce({
      title: "Backend Engineer", company: "Acme", location: "Remote", seniority: "Senior",
      required: [
        { requirement: "Go", evidence: [{ kind: "skill", id: go }] },
        { requirement: "Kafka", evidence: [{ kind: "experience", id: crypto.randomUUID() }] },
      ],
      niceToHave: [],
      keywords: ["Go", "Kafka"],
      recommendedRepos: [{ repoId: excluded.id, reason: "x" }, { repoId: kept.id, reason: "Go service" }],
    });

    const jobId = await analyzeAndSaveJob(userId, "We need Go and Kafka. ".repeat(5), null);
    const job = (await getJob(userId, jobId))!;
    expect(job.analysis.required.map((r) => r.matched)).toEqual([true, false]);
    expect(job.analysis.matchScore).toBe(50);
    expect(job.recommended.map((r) => r.name)).toEqual(["kept"]);
    expect((await listJobs(userId))[0]).toMatchObject({ id: jobId, title: "Backend Engineer", matchScore: 50, status: null });
    expect(await getJob(userId, "not-a-uuid")).toBeNull();
  });
});
