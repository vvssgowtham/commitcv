import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateAwards, candidateCertifications, candidateEducation, candidateExperience,
  candidateProfiles, candidateProfileSources, candidateProjects, candidateSkills, resumes,
} from "@/db/schema";
import { emptyProfile, profileSchema, type Profile, type SourceType } from "@/lib/profile";
import { applyChanges, diffResume, type ParsedResume } from "@/lib/resume-merge";

type Section = keyof typeof tables;
type Row = Record<string, unknown> & { id: string; source: SourceType };

const tables = {
  experience: candidateExperience,
  education: candidateEducation,
  projects: candidateProjects,
  skills: candidateSkills,
  certifications: candidateCertifications,
  awards: candidateAwards,
};

// DB keeps NULL for "no value"; the profile shape uses "" / [].
const fromRow = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => k !== "profileId").map(([k, v]) => [k, v ?? (k === "technologies" ? [] : "")])) as Row;
const toRow = (item: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v === "" ? null : v]));

// No position column: show dated sections newest first, the rest alphabetically.
const sortBy: Record<Section, { key: string; desc: boolean }> = {
  experience: { key: "startDate", desc: true }, education: { key: "startDate", desc: true },
  certifications: { key: "issueDate", desc: true }, awards: { key: "date", desc: true },
  projects: { key: "name", desc: false }, skills: { key: "skill", desc: false },
};
const sortRows = (k: Section, rows: Row[]) => {
  const { key, desc } = sortBy[k];
  return rows.toSorted((a, b) => String(a[key]).localeCompare(String(b[key])) * (desc ? -1 : 1));
};

const sameContent = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).every((k) => k === "id" || k === "source" || JSON.stringify(a[k]) === JSON.stringify(b[k]));

export type StoredParsedResume = Required<ParsedResume> & { contact: Profile["contact"] };

async function profileRow(userId: string) {
  const row = await db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.userId, userId) });
  if (row) return row;
  // Created by the sign-up hook; this covers users from before the hook existed.
  const [created] = await db.insert(candidateProfiles).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.userId, userId) }))!;
}

export async function getProfile(userId: string): Promise<Profile> {
  const p = await profileRow(userId);
  const link = (label: string) => p.links.find((l) => l.label === label)?.url ?? "";
  const sections = await Promise.all(
    (Object.keys(tables) as Section[]).map(async (k) => {
      const t = tables[k];
      const rows = await db.select().from(t).where(eq(t.profileId, p.id));
      return [k, sortRows(k, rows.map(fromRow))] as const;
    }),
  );
  return {
    ...emptyProfile,
    summary: p.summary ?? "",
    contact: { phone: p.phone ?? "", location: p.location ?? "", linkedin: link("LinkedIn"), github: link("GitHub") },
    ...Object.fromEntries(sections),
  } as Profile;
}

/**
 * Replace the user's profile with `input`.
 * - mode "user": provenance is decided here, not by the client — new items are MANUAL, edited RESUME items
 *   become USER_EDIT, everything else keeps its stored source.
 * - mode "import": sources come from the merge (RESUME for imported items).
 * Item ids from the client are only honoured when they already belong to this profile.
 */
export async function writeProfile(userId: string, input: Profile, mode: "user" | "import") {
  const next = profileSchema.parse(input);
  const p = await profileRow(userId);
  const links = [
    next.contact.linkedin && { label: "LinkedIn", url: next.contact.linkedin },
    next.contact.github && { label: "GitHub", url: next.contact.github },
  ].filter((l): l is { label: string; url: string } => !!l);

  await db.transaction(async (tx) => {
    await tx.update(candidateProfiles)
      .set({ summary: next.summary || null, phone: next.contact.phone || null, location: next.contact.location || null, links })
      .where(eq(candidateProfiles.id, p.id));

    for (const k of Object.keys(tables) as Section[]) {
      const t = tables[k];
      const existing = new Map((await tx.select().from(t).where(eq(t.profileId, p.id))).map((r) => [r.id, fromRow(r)]));
      let items = next[k] as Row[];
      if (k === "skills") {
        const seen = new Set<string>();
        items = items.filter((s) => !seen.has(String(s.skill).toLowerCase()) && seen.add(String(s.skill).toLowerCase()));
      }
      const kept: string[] = [];
      for (const { id, source, ...fields } of items) {
        const old = existing.get(id);
        if (old) {
          const nextSource = mode === "import" ? source : !sameContent(old, fields) && old.source === "RESUME" ? "USER_EDIT" : old.source;
          await tx.update(t).set({ ...toRow(fields), source: nextSource }).where(and(eq(t.id, id), eq(t.profileId, p.id)));
          kept.push(id);
        } else {
          const [row] = await tx.insert(t)
            .values({ ...toRow(fields), profileId: p.id, source: mode === "import" ? source : "MANUAL" } as typeof t.$inferInsert)
            .returning({ id: t.id });
          kept.push(row.id);
        }
      }
      await tx.delete(t).where(and(eq(t.profileId, p.id), kept.length ? notInArray(t.id, kept) : undefined));
    }
  });
  return getProfile(userId);
}

async function parsedResume(userId: string, resumeId: string) {
  const row = await db.query.resumes.findFirst({ where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)) });
  if (!row?.parsedContent) throw new Error("Resume not found");
  return row.parsedContent as StoredParsedResume;
}

export async function previewImport(userId: string, resumeId: string) {
  return diffResume(await getProfile(userId), await parsedResume(userId, resumeId));
}

/** Apply the selected changes from a parsed resume (all actionable ones when `changeIds` is "all"). */
export async function applyImport(userId: string, resumeId: string, changeIds: string[] | "all") {
  const parsed = await parsedResume(userId, resumeId);
  const current = await getProfile(userId);
  // Recomputed server-side: the client only chooses which change ids to accept, never their content.
  const changes = diffResume(current, parsed).filter((c) => c.kind !== "kept" && (changeIds === "all" || changeIds.includes(c.id)));
  const next = applyChanges(current, changes, () => crypto.randomUUID());
  // Contact details only fill blanks; they never overwrite what the user has.
  next.contact = Object.fromEntries(
    Object.entries(current.contact).map(([k, v]) => [k, v || parsed.contact[k as keyof Profile["contact"]] || ""]),
  ) as Profile["contact"];
  const saved = await writeProfile(userId, next, "import");
  const { id: profileId } = await profileRow(userId);
  await db.insert(candidateProfileSources).values({ profileId, sourceType: "RESUME", sourceReference: resumeId });
  return saved;
}
