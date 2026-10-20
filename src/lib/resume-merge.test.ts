import { test } from "vitest";
import assert from "node:assert/strict";
import type { Profile } from "./profile";
import { applyChanges, diffResume } from "./resume-merge";

const base = (): Profile => ({
  summary: "Old summary",
  contact: { phone: "", location: "", linkedin: "", github: "", portfolio: "" },
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

test("a re-parsed subtitle appended to institution/project name isn't a new entry", () => {
  const p = base();
  p.education = [{ id: "e", institution: "Acme University", degree: "BTech", fieldOfStudy: "CS", startDate: "2020-01", endDate: "2024-01", grade: "", description: "", source: "RESUME" }];
  p.projects = [{ id: "pr", name: "DocuTalk", description: "RAG pipeline", url: "", technologies: [], source: "RESUME" }];

  const changes = diffResume(p, {
    education: [{ institution: "Acme University — Hyderabad, India", degree: "BTech", fieldOfStudy: "CS", startDate: "2020-01", endDate: "2024-01", grade: "", description: "" }],
    projects: [{ name: "DocuTalk — Chat-with-PDF (RAG)", description: "RAG pipeline", url: "", technologies: [] }],
  });

  assert.deepEqual(changes.map((c) => c.kind).sort(), ["update", "update"]);
  assert.deepEqual(changes.map((c) => (c as { targetId: string }).targetId).sort(), ["e", "pr"]);
});

test("re-importing heals an existing duplicate pair by removing the redundant RESUME row", () => {
  const p = base();
  p.projects = [
    { id: "keep", name: "DocuTalk — Chat-with-PDF (RAG)", description: "RAG pipeline", url: "https://x", technologies: [], source: "RESUME" },
    { id: "dupe", name: "DocuTalk — Chat-with-PDF (RAG)", description: "RAG pipeline", url: "https://x", technologies: [], source: "RESUME" },
  ];

  const changes = diffResume(p, { projects: [{ name: "DocuTalk — Chat-with-PDF (RAG)", description: "RAG pipeline", url: "https://x", technologies: [] }] });
  assert.deepEqual(changes.map((c) => c.kind), ["remove"]);
  assert.equal((changes[0] as { targetId: string }).targetId, "dupe");

  const next = applyChanges(p, changes, () => "unused");
  assert.deepEqual(next.projects.map((pr) => pr.id), ["keep"]);
});

test("re-importing heals a duplicate without touching the user's own edited row", () => {
  const p = base();
  p.projects = [
    { id: "mine", name: "ConnectMeIndia — Freelance Marketplace", description: "d", url: "", technologies: [], source: "USER_EDIT" },
    { id: "stray", name: "ConnectMeIndia", description: "d", url: "https://connectmeindia.com", technologies: [], source: "RESUME" },
  ];

  const changes = diffResume(p, { projects: [{ name: "ConnectMeIndia", description: "d", url: "https://connectmeindia.com", technologies: [] }] });
  assert.deepEqual(changes.map((c) => c.kind).sort(), ["kept", "remove"]);
  assert.equal((changes.find((c) => c.kind === "remove") as { targetId: string }).targetId, "stray");

  const next = applyChanges(p, changes, () => "unused");
  assert.deepEqual(next.projects.map((pr) => pr.id), ["mine"]);
});
