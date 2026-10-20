import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Info, X } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { verifySession } from "@/lib/dal";
import { fmtMonth } from "@/lib/profile";
import { getGeneration, type ResumeDoc } from "@/server/generate";
import { DownloadButton } from "./download-button";

// Generated resume — clean document style (design/README.md): single column, black on white, no colour,
// standard headings, real text — the same layout as the PDF. App chrome stays outside the page.

const range = (start: string, end: string) => (start ? `${fmtMonth(start)} – ${fmtMonth(end)}` : end ? fmtMonth(end) : "");

export default async function ResumePage({ params }: PageProps<"/resumes/[id]">) {
  const { user } = await verifySession();
  const gen = await getGeneration(user.id, (await params).id);
  if (!gen?.job) notFound();
  const { job, doc, ats } = gen;

  return (
    <div className="min-h-dvh bg-neutral-100">
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-8">
          <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
            <ArrowLeft className="size-4" aria-hidden /> {job.company ?? "Job"}
          </Link>
          <span className="text-neutral-300" aria-hidden>/</span>
          <h1 className="truncate text-sm font-medium text-neutral-900">Resume · {job.title ?? "Untitled role"}</h1>
          {gen.status === "ready" && <div className="ml-auto"><DownloadButton generationId={gen.id} /></div>}
        </div>
      </div>

      {gen.status !== "ready" || !doc || !ats ? (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="text-base font-semibold text-neutral-900">{gen.status === "failed" ? "This resume couldn't be generated" : "Still generating…"}</p>
          <p className="mt-2 text-sm text-neutral-500">{gen.status === "failed" ? gen.error ?? "Please try again from the job page." : "Refresh in a moment."}</p>
          <Link href={`/jobs/${job.id}`} className="mt-6 inline-block text-sm font-medium text-neutral-900 underline">Back to the job</Link>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ResumeArticle doc={doc} />

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-4">
                <ScoreRing value={ats.score} label="keyword coverage" />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Keyword coverage</p>
                  <p className="text-xs text-neutral-500">Job keywords found in this resume</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {ats.checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-neutral-700">
                    {c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Pass" /> : <X className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Fail" />}
                    {c.label}
                  </li>
                ))}
              </ul>
              {ats.keywordsMissing.length > 0 && (
                <p className="mt-4 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                  Not in your profile: {ats.keywordsMissing.join(", ")}. Add them to your profile only if they’re true for you.
                </p>
              )}
            </section>
            {(doc.grounding.replacedBullets > 0 || doc.grounding.summaryFromProfile) && (
              <p className="flex gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-xs text-neutral-600">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {doc.grounding.replacedBullets > 0 && `${doc.grounding.replacedBullets} suggested ${doc.grounding.replacedBullets === 1 ? "bullet was" : "bullets were"} replaced with your original wording because ${doc.grounding.replacedBullets === 1 ? "it" : "they"} added details not in your profile. `}
                  {doc.grounding.summaryFromProfile && "The summary is your own, unchanged."}
                </span>
              </p>
            )}
            <Link href="/profile" className="block rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 hover:border-neutral-300 hover:text-neutral-900">
              Need to change something? <span className="font-medium text-neutral-900">Edit your profile →</span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

function ResumeArticle({ doc }: { doc: ResumeDoc }) {
  const h = doc.header;
  return (
    <article className="mx-auto w-full max-w-[816px] bg-white px-8 py-10 font-sans text-[13px] leading-[1.45] text-black shadow-sm ring-1 ring-neutral-200 sm:px-14 sm:py-12">
      <header className="text-center">
        <h2 className="text-[24px] font-bold tracking-tight">{h.name}</h2>
        <p className="mt-1 text-[12px]">{[h.location, h.phone, h.email, ...h.links].filter(Boolean).join("  |  ")}</p>
      </header>

      {doc.summary && <Section title="Summary"><p>{doc.summary}</p></Section>}

      {doc.skills.length > 0 && (
        <Section title="Skills">
          <ul>{doc.skills.map((g) => <li key={g.category}><span className="font-semibold">{g.category}:</span> {g.items.join(", ")}</li>)}</ul>
        </Section>
      )}

      {doc.experience.length > 0 && (
        <Section title="Experience">
          {doc.experience.map((e, i) => (
            <div key={i} className="mt-2 first:mt-0">
              <div className="flex justify-between gap-4"><span className="font-semibold">{e.title}, {e.company}</span><span className="shrink-0">{range(e.startDate, e.endDate)}</span></div>
              <ul className="mt-1 list-disc pl-5">{e.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          ))}
        </Section>
      )}

      {doc.projects.length > 0 && (
        <Section title="Projects">
          {doc.projects.map((p, i) => (
            <div key={i} className="mt-2 first:mt-0">
              <div className="flex justify-between gap-4">
                <span><span className="font-semibold">{p.name}</span>{p.tech.length > 0 && ` | ${p.tech.join(", ")}`}</span>
                <span className="shrink-0">{p.url.replace(/^https?:\/\//, "")}</span>
              </div>
              <ul className="mt-1 list-disc pl-5">{p.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          ))}
        </Section>
      )}

      {doc.education.length > 0 && (
        <Section title="Education">
          {doc.education.map((e, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span><span className="font-semibold">{e.institution}</span>{[e.degree, e.fieldOfStudy].some(Boolean) && ` — ${[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}`}{e.grade && ` (${e.grade})`}</span>
              <span className="shrink-0">{range(e.startDate, e.endDate)}</span>
            </div>
          ))}
        </Section>
      )}

      {(doc.certifications.length > 0 || doc.awards.length > 0) && (
        <Section title="Certifications & Awards">
          <ul className="list-disc pl-5">
            {doc.certifications.map((c, i) => <li key={`c${i}`}>{[c.name, c.issuer, c.date && fmtMonth(c.date)].filter(Boolean).join(" — ")}</li>)}
            {doc.awards.map((a, i) => <li key={`a${i}`}>{[a.name, a.issuer, a.date && fmtMonth(a.date)].filter(Boolean).join(" — ")}</li>)}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 border-b border-black pb-0.5 text-[13px] font-bold tracking-wider uppercase">{title}</h3>
      {children}
    </section>
  );
}
