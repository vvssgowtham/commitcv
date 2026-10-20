import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

vi.mock("@/server/services/llm", () => ({ structured: vi.fn(), LlmError: class extends Error {} }));
const stored: Record<string, Uint8Array> = {};
vi.mock("@/server/services/storage", () => ({
  putObject: vi.fn(async (key: string, body: Uint8Array) => { stored[key] = body; }),
}));

describe.skipIf(!url)("resume generation", () => {
  let userId = "";
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
    const [u] = await db.insert(schema.users).values({ name: "Asha Rao", email: `g-${crypto.randomUUID()}@example.com` }).returning();
    userId = u.id;
  });
  afterAll(async () => { if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId)); });

  test("a hallucinating model cannot put invented facts on the resume", async () => {
    const { writeProfile, getProfile } = await import("./profile");
    const { structured } = await import("@/server/services/llm");
    const { analyzeAndSaveJob } = await import("./jobs");
    const { generateResume, getGeneration } = await import("./generate");

    const profile = await writeProfile(userId, {
      ...(await getProfile(userId)),
      summary: "Backend engineer building payment APIs in Go.",
      experience: [{ id: "e", source: "MANUAL", company: "Acme", jobTitle: "Engineer", employmentType: "", startDate: "2021-03", endDate: "",
        description: "Built payment APIs in Go handling 2M requests per day\nReduced p95 latency from 900ms to 350ms with Redis" }],
      skills: [{ id: "s", source: "MANUAL", skill: "Go", category: "Languages" }, { id: "r", source: "MANUAL", skill: "Redis", category: "Data" }],
      education: [{ id: "ed", source: "MANUAL", institution: "IIT Madras", degree: "B.Tech", fieldOfStudy: "CS", startDate: "2016", endDate: "2020", grade: "", description: "" }],
    }, "user");
    const exp = profile.experience[0];
    const go = profile.skills.find((s) => s.skill === "Go")!;

    vi.mocked(structured).mockResolvedValueOnce({
      title: "Backend Engineer", company: "Stripe", location: "", seniority: "",
      required: [{ requirement: "Go", evidence: [{ kind: "skill", id: go.id }] }, { requirement: "Kafka", evidence: [] }],
      niceToHave: [], keywords: ["Go", "Kafka", "payments"], recommendedRepos: [],
    });
    const jobId = await analyzeAndSaveJob(userId, "Backend Engineer at Stripe. Go, Kafka, payments. ".repeat(3), null);

    vi.mocked(structured).mockResolvedValueOnce({
      summary: "Senior engineer with 8 years at Stripe scaling Kafka pipelines.", // invented years, employer, tech
      experience: [{ id: exp.id, bullets: [
        { text: "Built Go payment APIs serving 2M requests per day", sourceLine: 0 }, // grounded rephrase
        { text: "Cut p95 latency by 75% using Redis and Kafka", sourceLine: 1 }, // invented % and Kafka
        { text: "Led a team of 12 engineers", sourceLine: 9 }, // cites a line that doesn't exist
      ] }],
      projects: [{ kind: "repo", id: crypto.randomUUID(), bullets: [{ text: "Fake project", sourceLine: 0 }] }], // not the user's
      skillIds: [go.id, "made-up-skill"],
    });

    const id = await generateResume(userId, jobId, []);
    const gen = (await getGeneration(userId, id))!;
    expect(gen.status).toBe("ready");
    const doc = gen.doc!;
    const all = JSON.stringify(doc);

    expect(doc.header).toMatchObject({ name: "Asha Rao" });
    expect(doc.summary).toBe("Backend engineer building payment APIs in Go."); // model summary rejected
    expect(doc.experience[0]).toMatchObject({ title: "Engineer", company: "Acme", startDate: "2021-03" }); // facts from DB
    expect(doc.experience[0].bullets).toEqual([
      "Built Go payment APIs serving 2M requests per day",
      "Reduced p95 latency from 900ms to 350ms with Redis", // original line restored
    ]);
    expect(doc.projects).toEqual([]);
    expect(doc.education[0]).toMatchObject({ institution: "IIT Madras", startDate: "2016" });
    for (const fake of ["Kafka", "Stripe", "75%", "8 years", "12 engineers", "Fake project"]) expect(all).not.toContain(fake);
    expect(doc.grounding).toEqual({ replacedBullets: 1, droppedBullets: 1, summaryFromProfile: true });

    expect(gen.ats).toMatchObject({ keywordsCovered: ["Go", "payments"], keywordsMissing: ["Kafka"], score: 67 });
    const pdf = stored[gen.pdfFileKey!];
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe("%PDF-");
  }, 30_000);
});
