import type { Profile } from "./mock-data";

// Re-importing a resume must never clobber what the user typed: items they added (MANUAL) or edited
// (USER_EDIT) are kept as-is; only items that came from a previous resume (RESUME) can be updated.

type ListKey = "education" | "experience" | "projects" | "certifications" | "awards";

// Parser output: same fields as the profile, minus the ids and provenance we assign on apply.
export type ParsedResume = { summary?: string; skills?: { skill: string; category: string }[] } & {
  [K in ListKey]?: Omit<Profile[K][number], "id" | "source">[];
};

export type Change =
  | { id: string; kind: "summary"; before: string; after: string }
  | { id: string; kind: "add"; section: ListKey; label: string; item: Record<string, unknown> }
  | { id: string; kind: "update"; section: ListKey; label: string; targetId: string; item: Record<string, unknown> }
  | { id: string; kind: "skill"; label: string; skill: { skill: string; category: string } }
  | { id: string; kind: "kept"; section: ListKey; label: string };

const identity: Record<ListKey, (x: Record<string, unknown>) => string> = {
  experience: (x) => `${x.company}|${x.jobTitle}`,
  education: (x) => `${x.institution}|${x.degree}`,
  projects: (x) => `${x.name}`,
  certifications: (x) => `${x.name}`,
  awards: (x) => `${x.name}`,
};

const label: Record<ListKey, (x: Record<string, unknown>) => string> = {
  experience: (x) => `${x.jobTitle}, ${x.company}`,
  education: (x) => `${x.degree}, ${x.institution}`,
  projects: (x) => `${x.name}`,
  certifications: (x) => `${x.name}`,
  awards: (x) => `${x.name}`,
};

const norm = (s: string) => s.trim().toLowerCase();
const content = (x: Record<string, unknown>) => JSON.stringify({ ...x, id: undefined, source: undefined });

export function diffResume(profile: Profile, parsed: ParsedResume): Change[] {
  const changes: Change[] = [];

  if (parsed.summary && norm(parsed.summary) !== norm(profile.summary)) {
    changes.push({ id: "summary", kind: "summary", before: profile.summary, after: parsed.summary });
  }

  for (const section of Object.keys(identity) as ListKey[]) {
    const existing = profile[section] as unknown as Record<string, unknown>[];
    for (const item of (parsed[section] ?? []) as unknown as Record<string, unknown>[]) {
      const key = norm(identity[section](item));
      const match = existing.find((e) => norm(identity[section](e)) === key);
      const id = `${section}:${key}`;
      if (!match) changes.push({ id, kind: "add", section, label: label[section](item), item });
      else if (content(match) === content(item)) continue;
      else if (match.source === "RESUME") changes.push({ id, kind: "update", section, label: label[section](item), targetId: match.id as string, item });
      else changes.push({ id, kind: "kept", section, label: label[section](match) });
    }
  }

  const have = new Set(profile.skills.map((s) => norm(s.skill)));
  for (const s of parsed.skills ?? []) {
    if (!have.has(norm(s.skill))) changes.push({ id: `skill:${norm(s.skill)}`, kind: "skill", label: s.skill, skill: s });
  }

  return changes;
}

export function applyChanges(profile: Profile, changes: Change[], newId: () => string): Profile {
  const next = structuredClone(profile);
  for (const c of changes) {
    if (c.kind === "summary") next.summary = c.after;
    else if (c.kind === "skill") next.skills.push({ id: newId(), ...c.skill, source: "RESUME" });
    else if (c.kind === "add") (next[c.section] as unknown as Record<string, unknown>[]).push({ ...c.item, id: newId(), source: "RESUME" });
    else if (c.kind === "update") {
      const list = next[c.section] as unknown as Record<string, unknown>[];
      const i = list.findIndex((x) => x.id === c.targetId);
      list[i] = { ...c.item, id: c.targetId, source: "RESUME" };
    }
  }
  return next;
}
