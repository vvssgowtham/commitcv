import { test } from "vitest";
import assert from "node:assert/strict";
import type { Profile } from "./profile";
import { applyChanges, diffResume } from "./resume-merge";

const base = (): Profile => ({
  summary: "Old summary",
  contact: { phone: "", location: "", linkedin: "", github: "" },
  education: [],
  experience: [
    { id: "a", company: "Acme", jobTitle: "Engineer", employmentType: "", startDate: "2020-01", endDate: "", description: "old", source: "RESUME" },
    { id: "b", company: "Beta", jobTitle: "Dev", employmentType: "", startDate: "2018-01", endDate: "2019-12", description: "mine", source: "USER_EDIT" },
  ],
  projects: [],
  skills: [{ id: "s", skill: "Go", category: "Languages", source: "MANUAL" }],
  certifications: [],
  awards: [],
});

test("adds new items, updates resume-sourced items, keeps user edits", () => {
  const parsed = {
    summary: "New summary",
    experience: [
      { company: "acme", jobTitle: "engineer", employmentType: "", startDate: "2020-01", endDate: "", description: "new" },
      { company: "Beta", jobTitle: "Dev", employmentType: "", startDate: "2018-01", endDate: "2019-12", description: "theirs" },
      { company: "Gamma", jobTitle: "Lead", employmentType: "", startDate: "2024-01", endDate: "", description: "x" },
    ],
    skills: [{ skill: "go", category: "Languages" }, { skill: "Kafka", category: "Data" }],
  };
  const changes = diffResume(base(), parsed);
  assert.deepEqual(changes.map((c) => c.kind).sort(), ["add", "kept", "skill", "summary", "update"]);

  let n = 0;
  const next = applyChanges(base(), changes.filter((c) => c.kind !== "kept"), () => `new${n++}`);
  assert.equal(next.summary, "New summary");
  assert.equal(next.experience.find((e) => e.id === "a")!.description, "new");
  assert.equal(next.experience.find((e) => e.id === "b")!.description, "mine");
  assert.equal(next.experience.length, 3);
  assert.deepEqual(next.skills.map((s) => s.skill), ["Go", "Kafka"]);
});

test("identical resume produces no changes", () => {
  const p = base();
  assert.deepEqual(diffResume(p, { summary: p.summary, experience: [{ ...p.experience[0] }] }), []);
});
