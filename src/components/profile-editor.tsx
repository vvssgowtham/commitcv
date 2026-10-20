"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, GripVertical, Plus, Trash2, X } from "lucide-react";
import type { Profile, SourceType } from "@/lib/mock-data";
import { ResumeReimport } from "@/components/resume-reimport";

// Profile editor — design/notion.md: warm paper canvas, document column, borderless blocks,
// one blue action, sticker colours only as decorative source dots.

type Field = { key: string; label: string; type?: "text" | "date" | "textarea" | "url"; wide?: boolean };
type ListKey = "education" | "experience" | "projects" | "certifications" | "awards";
type Item = Record<string, unknown> & { id: string; source: SourceType };

const sections: { key: ListKey; title: string; emoji: string; fields: Field[] }[] = [
  {
    key: "experience", title: "Experience", emoji: "💼",
    fields: [
      { key: "jobTitle", label: "Job title" }, { key: "company", label: "Company" },
      { key: "employmentType", label: "Employment type" }, { key: "startDate", label: "Start (YYYY-MM)", type: "date" }, { key: "endDate", label: "End YYYY-MM (empty = present)", type: "date" },
      { key: "description", label: "What you did — one achievement per line, start with a verb, add numbers", type: "textarea", wide: true },
    ],
  },
  {
    key: "education", title: "Education", emoji: "🎓",
    fields: [
      { key: "institution", label: "Institution" }, { key: "degree", label: "Degree" }, { key: "fieldOfStudy", label: "Field of study" },
      { key: "startDate", label: "Start (YYYY-MM)", type: "date" }, { key: "endDate", label: "End (YYYY-MM)", type: "date" }, { key: "grade", label: "Grade / GPA" },
      { key: "description", label: "Coursework, honours (optional)", type: "textarea", wide: true },
    ],
  },
  {
    key: "projects", title: "Projects", emoji: "🛠️",
    fields: [
      { key: "name", label: "Project name" }, { key: "url", label: "Link", type: "url" }, { key: "technologies", label: "Technologies (comma separated)", wide: true },
      { key: "description", label: "What it does and the impact", type: "textarea", wide: true },
    ],
  },
  {
    key: "certifications", title: "Certifications", emoji: "📜",
    fields: [
      { key: "name", label: "Certification" }, { key: "issuingOrganization", label: "Issued by" },
      { key: "issueDate", label: "Issued (YYYY-MM)", type: "date" }, { key: "credentialUrl", label: "Credential URL", type: "url" },
    ],
  },
  {
    key: "awards", title: "Awards", emoji: "🏆",
    fields: [
      { key: "name", label: "Award" }, { key: "issuer", label: "Issuer" }, { key: "date", label: "Date (YYYY-MM)", type: "date" },
      { key: "description", label: "Why you received it (optional)", type: "textarea", wide: true },
    ],
  },
];

const sourceDot: Record<SourceType, string> = { RESUME: "bg-no-sky", MANUAL: "bg-no-purple", GITHUB: "bg-no-green", USER_EDIT: "bg-no-orange" };
const sourceLabel: Record<SourceType, string> = { RESUME: "From resume", MANUAL: "Added manually", GITHUB: "From GitHub", USER_EDIT: "Edited" };

const blockInput =
  "w-full rounded-[4px] bg-transparent px-1.5 py-1 text-[15px] text-no-ink placeholder:text-no-ink-faint hover:bg-black/[0.03] focus:bg-white focus:shadow-no-soft focus:outline-none";

export function ProfileEditor({ initial, name, email, mode }: { initial: Profile; name: string; email: string; mode: "edit" | "onboarding" }) {
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [skillDraft, setSkillDraft] = useState("");

  const update = (next: Profile) => { setP(next); setSaved(false); };
  const list = (k: ListKey) => p[k] as unknown as Item[];
  const setList = (k: ListKey, items: Item[]) => update({ ...p, [k]: items });

  const filled = [p.summary.trim(), ...sections.map((s) => list(s.key).length), p.skills.length].filter(Boolean).length;
  const total = sections.length + 2;

  function addSkill() {
    const v = skillDraft.trim();
    if (!v || p.skills.some((s) => s.skill.toLowerCase() === v.toLowerCase())) return setSkillDraft("");
    update({ ...p, skills: [...p.skills, { id: crypto.randomUUID(), skill: v, category: "Other", source: "MANUAL" }] });
    setSkillDraft("");
  }

  const skillGroups = Object.entries(Object.groupBy(p.skills, (s) => s.category));

  return (
    <div className="min-h-dvh bg-no-canvas text-no-ink">
      <div className="mx-auto max-w-[760px] px-4 pt-12 pb-32 sm:px-8">
        {mode === "onboarding" && (
          <div className="mb-8 rounded-xl border border-no-hairline bg-white p-4 shadow-no-soft">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Profile {Math.round((filled / total) * 100)}% complete</span>
              <span className="text-no-ink-muted">{filled} of {total} sections</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-no-canvas" role="progressbar" aria-valuenow={filled} aria-valuemax={total} aria-label="Profile completion">
              <div className="h-full rounded-full bg-no-blue transition-all" style={{ width: `${(filled / total) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="text-5xl" aria-hidden>📄</div>
          {mode === "edit" && <ResumeReimport profile={p} onApply={update} />}
        </div>
        <h1 className="mt-4 text-[40px] leading-[1.1] font-bold tracking-[-1px]">{name || "Your profile"}</h1>
        <p className="mt-2 text-no-ink-muted">Your single source of truth. Every tailored resume is built from this page.</p>

        {/* Properties */}
        <dl className="mt-8 grid gap-y-1 text-[15px] sm:grid-cols-[160px_1fr]">
          <dt className="py-1 text-no-ink-muted">Email</dt>
          <dd className="px-1.5 py-1">{email}</dd>
          {(Object.keys(p.contact) as (keyof Profile["contact"])[]).map((k) => (
            <div key={k} className="contents">
              <dt className="py-1 text-no-ink-muted capitalize">{k}</dt>
              <dd>
                <input className={blockInput} value={p.contact[k]} placeholder="Empty" aria-label={k}
                  onChange={(e) => update({ ...p, contact: { ...p.contact, [k]: e.target.value } })} />
              </dd>
            </div>
          ))}
        </dl>

        <hr className="my-10 border-no-hairline" />

        {/* Summary */}
        <section aria-labelledby="summary-h">
          <SectionHeading id="summary-h" emoji="✍️" title="Summary" />
          <textarea
            className={`${blockInput} mt-2 [field-sizing:content] min-h-24 resize-none leading-relaxed`}
            value={p.summary}
            placeholder="2–3 sentences: who you are, what you build, one quantified win."
            aria-label="Summary"
            onChange={(e) => update({ ...p, summary: e.target.value })}
          />
        </section>

        {/* Skills */}
        <section aria-labelledby="skills-h" className="mt-12">
          <SectionHeading id="skills-h" emoji="⚡" title="Skills" />
          <div className="mt-3 space-y-3">
            {skillGroups.map(([cat, items]) => (
              <div key={cat} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <span className="w-32 shrink-0 pt-1 text-sm text-no-ink-muted">{cat}</span>
                <ul className="flex flex-wrap gap-1.5">
                  {items!.map((s) => (
                    <li key={s.id} className="group inline-flex items-center gap-1.5 rounded-[5px] border border-no-hairline bg-white py-0.5 pr-1 pl-2 text-sm">
                      <span className={`size-1.5 rounded-full ${sourceDot[s.source]}`} title={sourceLabel[s.source]} aria-hidden />
                      {s.skill}
                      <button aria-label={`Remove ${s.skill}`} className="rounded p-0.5 text-no-ink-faint hover:bg-black/5 hover:text-no-ink"
                        onClick={() => update({ ...p, skills: p.skills.filter((x) => x.id !== s.id) })}>
                        <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <input className={`${blockInput} max-w-xs`} value={skillDraft} placeholder="+ Type a skill and press Enter" aria-label="Add skill"
              onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
          </div>
        </section>

        {/* List sections */}
        {sections.map((s) => (
          <section key={s.key} aria-labelledby={`${s.key}-h`} className="mt-12">
            <SectionHeading id={`${s.key}-h`} emoji={s.emoji} title={s.title} />
            <div className="mt-3 space-y-3">
              {list(s.key).map((item) => (
                <article key={item.id} className="group relative rounded-xl border border-no-hairline bg-white p-4 sm:p-5">
                  <GripVertical className="absolute top-5 -left-6 hidden size-4 text-no-ink-faint opacity-0 group-hover:opacity-100 sm:block" aria-hidden />
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-no-ink-muted">
                      <span className={`size-1.5 rounded-full ${sourceDot[item.source]}`} aria-hidden />{sourceLabel[item.source]}
                    </span>
                    <button aria-label={`Delete ${s.title} entry`} className="rounded p-1 text-no-ink-faint opacity-0 group-hover:opacity-100 hover:bg-black/5 hover:text-no-ink focus:opacity-100"
                      onClick={() => setList(s.key, list(s.key).filter((x) => x.id !== item.id))}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {s.fields.map((f) => {
                      const raw = item[f.key];
                      const value = Array.isArray(raw) ? raw.join(", ") : ((raw as string | null) ?? "");
                      const onChange = (v: string) =>
                        setList(s.key, list(s.key).map((x) => x.id === item.id ? { ...x, [f.key]: f.key === "technologies" ? v.split(",").map((t) => t.trimStart()) : v, source: x.source === "MANUAL" ? "MANUAL" : "USER_EDIT" } : x));
                      return (
                        <label key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                          <span className="sr-only">{f.label}</span>
                          {f.type === "textarea" ? (
                            <textarea className={`${blockInput} [field-sizing:content] min-h-16 resize-none leading-relaxed`} value={value} placeholder={f.label} onChange={(e) => onChange(e.target.value)} />
                          ) : (
                            <input type={f.type === "url" ? "url" : "text"} className={`${blockInput} ${f.key === "jobTitle" || f.key === "name" || f.key === "institution" ? "font-semibold" : ""}`} value={value} placeholder={f.label} onChange={(e) => onChange(e.target.value)} />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
              <button
                onClick={() => setList(s.key, [...list(s.key), { id: crypto.randomUUID(), source: "MANUAL" } as Item])}
                className="flex w-full items-center gap-2 rounded-[5px] px-1.5 py-1.5 text-left text-[15px] text-no-ink-faint hover:bg-black/[0.03] hover:text-no-ink-muted"
              >
                <Plus className="size-4" aria-hidden /> Add {s.title.toLowerCase().replace(/s$/, "")}
              </button>
            </div>
          </section>
        ))}
      </div>

      {/* Save bar */}
      <div className={`no-print fixed inset-x-0 bottom-0 z-10 ${mode === "edit" ? "md:left-[240px]" : ""}`}>
        <div className="mx-auto mb-4 flex max-w-[760px] items-center justify-between gap-4 rounded-xl border border-no-hairline bg-white px-4 py-3 shadow-no-soft sm:mx-8 lg:mx-auto">
          <span className="flex items-center gap-2 text-sm text-no-ink-muted" aria-live="polite">
            {saved ? <><Check className="size-4 text-no-green" aria-hidden /> All changes saved</> : "Unsaved changes"}
          </span>
          {mode === "onboarding" ? (
            <Link href="/dashboard" className="rounded-full bg-no-blue px-5 py-2 font-medium text-white active:bg-no-blue-active">Finish setup</Link>
          ) : (
            // shortcut: save only flips local state; wire to a server action later.
            <button onClick={() => setSaved(true)} disabled={saved} className="rounded-full bg-no-blue px-5 py-2 font-medium text-white active:bg-no-blue-active disabled:opacity-40">
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ id, emoji, title }: { id: string; emoji: string; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-[26px] leading-tight font-bold tracking-[-0.625px]">
      <span aria-hidden className="text-2xl">{emoji}</span>{title}
    </h2>
  );
}
