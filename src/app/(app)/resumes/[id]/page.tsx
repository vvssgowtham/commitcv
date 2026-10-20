import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { atsChecks, findJob, findRepo, fmtMonth, generations, profile, user } from "@/lib/mock-data";
import { PrintButton } from "./print-button";

// Generated resume — clean document style (design/README.md): single column, black on white, no colour,
// standard headings, real text — what ATS parsers read reliably. App chrome stays outside the page.

export function generateStaticParams() {
  return generations.map((g) => ({ id: g.id }));
}

export default async function ResumePage({ params }: PageProps<"/resumes/[id]">) {
  const { id } = await params;
  const gen = generations.find((g) => g.id === id);
  const job = gen && findJob(gen.jobId);
  if (!gen || !job) notFound();
  const projects = job.analysis.recommendedRepos.map((r) => ({ ...findRepo(r.repoId)! }));
  const skillsByCat = Object.entries(Object.groupBy(profile.skills, (s) => s.category));
  const c = profile.contact;

  return (
    <div className="min-h-dvh bg-neutral-100 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-8">
          <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
            <ArrowLeft className="size-4" aria-hidden /> {job.company}
          </Link>
          <span className="text-neutral-300" aria-hidden>/</span>
          <h1 className="truncate text-sm font-medium text-neutral-900">Resume · {job.title}</h1>
          <div className="ml-auto"><PrintButton /></div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] print:block print:p-0">
        {/* The page */}
        <article className="mx-auto w-full max-w-[816px] bg-white px-8 py-10 font-sans text-[13px] leading-[1.45] text-black shadow-sm ring-1 ring-neutral-200 sm:px-14 sm:py-12 print:max-w-none print:p-0 print:shadow-none print:ring-0">
          <header className="text-center">
            <h2 className="text-[24px] font-bold tracking-tight">{user.name}</h2>
            <p className="mt-1 text-[12px]">{[c.location, c.phone, user.email, c.linkedin, c.github].filter(Boolean).join("  |  ")}</p>
          </header>

          <ResumeSection title="Summary">
            <p>{profile.summary}</p>
          </ResumeSection>

          <ResumeSection title="Skills">
            <ul>
              {skillsByCat.map(([cat, items]) => (
                <li key={cat}><span className="font-semibold">{cat}:</span> {items!.map((s) => s.skill).join(", ")}</li>
              ))}
            </ul>
          </ResumeSection>

          <ResumeSection title="Experience">
            {profile.experience.map((e) => (
              <div key={e.id} className="mt-2 first:mt-0">
                <div className="flex justify-between gap-4"><span className="font-semibold">{e.jobTitle}, {e.company}</span><span className="shrink-0">{fmtMonth(e.startDate)} – {fmtMonth(e.endDate)}</span></div>
                <ul className="mt-1 list-disc pl-5">{e.description.split("\n").map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            ))}
          </ResumeSection>

          <ResumeSection title="Projects">
            {projects.map((p) => (
              <div key={p.id} className="mt-2 first:mt-0">
                <div className="flex justify-between gap-4"><span><span className="font-semibold">{p.name}</span> | {Object.keys(p.languages).slice(0, 2).join(", ")}</span><span className="shrink-0">{p.url}</span></div>
                <ul className="mt-1 list-disc pl-5"><li>{p.description}</li></ul>
              </div>
            ))}
          </ResumeSection>

          <ResumeSection title="Education">
            {profile.education.map((e) => (
              <div key={e.id} className="flex justify-between gap-4">
                <span><span className="font-semibold">{e.institution}</span> — {e.degree}, {e.fieldOfStudy}{e.grade && ` (${e.grade})`}</span>
                <span className="shrink-0">{fmtMonth(e.startDate)} – {fmtMonth(e.endDate)}</span>
              </div>
            ))}
          </ResumeSection>

          <ResumeSection title="Certifications & Awards">
            <ul className="list-disc pl-5">
              {profile.certifications.map((x) => <li key={x.id}>{x.name} — {x.issuingOrganization}, {fmtMonth(x.issueDate)}</li>)}
              {profile.awards.map((x) => <li key={x.id}>{x.name}</li>)}
            </ul>
          </ResumeSection>
        </article>

        {/* ATS report */}
        <aside className="no-print space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-4">
              <ScoreRing value={gen.atsScore || job.analysis.matchScore} label="ATS score" />
              <div>
                <p className="text-sm font-semibold text-neutral-900">ATS score</p>
                <p className="text-xs text-neutral-500">Tailored for {job.company}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm">
              {atsChecks.map((ch) => (
                <li key={ch.label} className="flex items-start gap-2 text-neutral-700">
                  {ch.ok ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Pass" /> : <X className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Fail" />}
                  {ch.label}
                </li>
              ))}
            </ul>
          </section>
          <Link href="/profile" className="block rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 hover:border-neutral-300 hover:text-neutral-900">
            Need to change something? <span className="font-medium text-neutral-900">Edit your profile →</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h3 className="mb-1.5 border-b border-black pb-0.5 text-[13px] font-bold tracking-wider uppercase">{title}</h3>
      {children}
    </section>
  );
}
