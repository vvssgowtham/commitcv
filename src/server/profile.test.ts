import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Profile } from "@/lib/profile";

// Integration: needs a migrated Postgres. `TEST_DATABASE_URL=postgres://... npm test`
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("profile persistence", () => {
  let userId = "";
  let mod: typeof import("./profile");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
    mod = await import("./profile");
    const [u] = await db.insert(schema.users).values({ name: "T", email: `p-${crypto.randomUUID()}@example.com` }).returning();
    userId = u.id;
  });
  afterAll(async () => { if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId)); });

  const exp = (over: Partial<Profile["experience"][number]>) => ({
    id: crypto.randomUUID(), source: "RESUME" as const, company: "Acme", jobTitle: "Engineer", employmentType: "",
    startDate: "2020-01", endDate: "", description: "Built things", ...over,
  });

  test("user saves: server decides provenance and ids", async () => {
    const empty = await mod.getProfile(userId);
    // Client claims RESUME and invents an id: server stores it as a new MANUAL item.
    const saved = await mod.writeProfile(userId, { ...empty, summary: "Hi", experience: [exp({})] }, "user");
    expect(saved.experience).toHaveLength(1);
    expect(saved.experience[0].source).toBe("MANUAL");
    expect(saved.summary).toBe("Hi");

    // Duplicate skills (case-insensitive) collapse to one.
    const withSkills = await mod.writeProfile(userId, { ...saved, skills: [
      { id: "a", source: "MANUAL", skill: "Go", category: "Languages" },
      { id: "b", source: "MANUAL", skill: "go", category: "Languages" },
    ] }, "user");
    expect(withSkills.skills.map((s) => s.skill)).toEqual(["Go"]);
  });

  test("resume import adds and updates, never overwrites user edits, fills only blank contact", async () => {
    const [resume] = await db.insert(schema.resumes).values({
      userId, fileKey: "test",
      parsedContent: {
        summary: "From resume",
        contact: { phone: "+1 555", location: "Berlin", linkedin: "", github: "" },
        experience: [
          { company: "Acme", jobTitle: "Engineer", employmentType: "", startDate: "2020-01", endDate: "", description: "Resume text" },
          { company: "Gamma", jobTitle: "Lead", employmentType: "", startDate: "2023", endDate: "", description: "Led" },
        ],
        skills: [{ skill: "Kafka", category: "Data" }],
      },
    }).returning();

    // Acme was added manually above → kept, not overwritten.
    const preview = await mod.previewImport(userId, resume.id);
    expect(preview.find((c) => c.kind === "kept")?.label).toBe("Engineer, Acme");

    const after = await mod.applyImport(userId, resume.id, "all");
    const acme = after.experience.find((e) => e.company === "Acme")!;
    const gamma = after.experience.find((e) => e.company === "Gamma")!;
    expect(acme.description).toBe("Built things");
    expect(gamma).toMatchObject({ source: "RESUME", startDate: "2023" });
    expect(after.summary).toBe("From resume");
    expect(after.contact.location).toBe("Berlin");
    expect(after.skills.map((s) => s.skill).sort()).toEqual(["Go", "Kafka"]);

    // Editing an imported item flips it to USER_EDIT, so the next import keeps it.
    const edited = await mod.writeProfile(userId, { ...after, experience: after.experience.map((e) => e.id === gamma.id ? { ...e, description: "Led a team of 4" } : e) }, "user");
    expect(edited.experience.find((e) => e.id === gamma.id)!.source).toBe("USER_EDIT");

    const sources = await db.select().from(schema.candidateProfileSources);
    expect(sources.some((s) => s.sourceReference === resume.id && s.sourceType === "RESUME")).toBe(true);
  });
});
