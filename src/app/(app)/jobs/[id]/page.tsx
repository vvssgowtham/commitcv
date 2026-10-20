import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, ExternalLink, Minus } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { findJob, findRepo, generationForJob, jobs } from "@/lib/mock-data";
import { GeneratePanel } from "./generate-panel";

// Job analysis — design/linear.md dark panels + design/jobright.md mint score ring and match chips.

export function generateStaticParams() {
  return jobs.map((j) => ({ id: j.id }));
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const job = findJob((await params).id);
  if (!job) notFound();
  const a = job.analysis;
  const gen = generationForJob(job.id);
  const recommended = a.recommendedRepos.map((r) => ({ ...findRepo(r.repoId)!, reason: r.reason }));
  const matched = a.required.filter((r) => r.matched).length;

  return (
    <div className="min-h-dvh bg-ln-canvas px-4 py-8 text-ln-ink sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ln-ink-subtle hover:text-ln-ink">
          <ArrowLeft className="size-4" aria-hidden /> Applications
        </Link>

        <header className="mt-4 flex flex-col gap-6 rounded-xl border border-ln-hairline bg-ln-surface-1 p-6 sm:flex-row sm:items-center">
          <ScoreRing value={a.matchScore} size={88} track="var(--color-ln-hairline-strong)" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium tracking-[0.4px] text-ln-ink-subtle">{job.company} · {job.location} · {a.seniority}</p>
            <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.6px]">{job.title}</h1>
            <p className="mt-2 text-sm text-ln-ink-subtle">
              You match <span className="text-ln-ink">{matched} of {a.required.length}</span> required skills.
              {a.missingInfo.length > 0 && <> Fill <span className="text-ln-ink">{a.missingInfo.length} gaps</span> to raise your score.</>}
            </p>
          </div>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start rounded-lg border border-ln-hairline bg-ln-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-ln-surface-3">
              View posting <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Panel title="Required">
              <SkillList items={a.required} />
            </Panel>
            <Panel title="Nice to have">
              <SkillList items={a.niceToHave} />
            </Panel>
            <Panel title="Keywords to include">
              <ul className="flex flex-wrap gap-1.5">
                {a.keywords.map((k) => (
                  <li key={k} className="rounded-md bg-ln-surface-3 px-2 py-1 font-mono text-[13px] text-ln-ink-muted">{k}</li>
                ))}
              </ul>
            </Panel>
            <Panel title="Job description">
              <details>
                <summary className="cursor-pointer text-sm text-ln-ink-subtle hover:text-ln-ink">Show full description</summary>
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ln-ink-muted">{job.description}</p>
              </details>
            </Panel>
          </div>

          <aside className="space-y-6">
            {a.missingInfo.length > 0 && (
              <Panel title="Fill these gaps">
                <ul className="space-y-3">
                  {a.missingInfo.map((m) => (
                    <li key={m.field} className="rounded-lg border border-ln-hairline bg-ln-surface-2 p-3">
                      <p className="flex items-start gap-2 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-ln-ink-subtle" aria-hidden />{m.field}</p>
                      <p className="mt-1 pl-6 text-xs text-ln-ink-subtle">{m.hint}</p>
                      <Link href="/profile" className="mt-2 ml-6 inline-block text-xs font-medium text-ln-primary hover:underline">Add to profile →</Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <GeneratePanel repos={recommended} generationId={gen!.id} existing={gen?.status === "Ready"} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-ln-hairline bg-ln-surface-1 p-5">
      <h2 className="mb-4 text-sm font-medium text-ln-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function SkillList({ items }: { items: { skill: string; matched: boolean }[] }) {
  return (
    <ul className="divide-y divide-ln-hairline">
      {items.map((s) => (
        <li key={s.skill} className="flex items-center justify-between py-2.5 text-sm">
          {s.skill}
          {s.matched ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-jr-mint px-2 py-0.5 text-xs font-medium text-black"><Check className="size-3" aria-hidden />In profile</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-ln-surface-3 px-2 py-0.5 text-xs text-ln-ink-subtle"><Minus className="size-3" aria-hidden />Missing</span>
          )}
        </li>
      ))}
    </ul>
  );
}
