import type { ListKey, Profile } from "./profile";

// Re-importing a resume must never clobber what the user typed: items they added (MANUAL) or edited
// (USER_EDIT) are kept as-is; only items that came from a previous resume (RESUME) can be updated or
// removed as a redundant duplicate of another row with the same identity.

// Parser output: same fields as the profile, minus the ids and provenance we assign on apply.
export type ParsedResume = { summary?: string; skills?: { skill: string; category: string }[] } & {
  [K in ListKey]?: Omit<Profile[K][number], "id" | "source">[];
};

export type Change =
  | { id: string; kind: "summary"; before: string; after: string }
  | { id: string; kind: "add"; section: ListKey; label: string; item: Record<string, unknown> }
  | { id: string; kind: "update"; section: ListKey; label: string; targetId: string; item: Record<string, unknown> }
  | { id: string; kind: "skill"; label: string; skill: { skill: string; category: string } }
  | { id: string; kind: "kept"; section: ListKey; label: string }
  | { id: string; kind: "remove"; section: ListKey; label: string; targetId: string };

// The parser sometimes folds a " — subtitle" (location, tagline) onto the institution/company/project
// name and sometimes doesn't, across separate parses of what is otherwise the same real entry — strip
// it so identity matching isn't fooled by that formatting noise.
const stripSubtitle = (x: unknown) => (typeof x === "string" ? x.replace(/\s[-–—]\s.*$/, "") : x);

const identity: Record<ListKey, (x: Record<string, unknown>) => string> = {
  experience: (x) => `${stripSubtitle(x.company)}|${x.jobTitle}`,
  education: (x) => `${stripSubtitle(x.institution)}|${x.degree}`,
  projects: (x) => `${stripSubtitle(x.name)}`,
  certifications: (x) => `${stripSubtitle(x.name)}`,
  awards: (x) => `${stripSubtitle(x.name)}`,
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
      const matches = existing.filter((e) => norm(identity[section](e)) === key);
      const id = `${section}:${key}`;
      if (matches.length === 0) {
        changes.push({ id, kind: "add", section, label: label[section](item), item });
        continue;
      }

      // A user-owned row (MANUAL/USER_EDIT) is always the canonical survivor; only a RESUME row can be
      // auto-updated. Any other RESUME row sharing this identity is a leftover duplicate — surface its
      // removal so the next import heals data an earlier bug duplicated, instead of leaving it forever.
      const protectedMatch = matches.find((m) => m.source !== "RESUME");
      const primary = protectedMatch ?? matches[0];
      if (content(primary) !== content(item)) {
        if (!protectedMatch) changes.push({ id, kind: "update", section, label: label[section](item), targetId: primary.id as string, item });
        else changes.push({ id, kind: "kept", section, label: label[section](primary) });
      }
      for (const dup of matches) {
        if (dup !== primary && dup.source === "RESUME") {
          changes.push({ id: `${id}:dup:${dup.id}`, kind: "remove", section, label: label[section](dup), targetId: dup.id as string });
        }
      }
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
    } else if (c.kind === "remove") {
      const list = next[c.section] as unknown as Record<string, unknown>[];
      const i = list.findIndex((x) => x.id === c.targetId);
      if (i !== -1) list.splice(i, 1);
    }
  }
  return next;
}
