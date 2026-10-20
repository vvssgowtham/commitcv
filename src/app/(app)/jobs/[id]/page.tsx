import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, ExternalLink, Minus } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { verifySession } from "@/lib/dal";
import type { Requirement } from "@/server/grounding";
import { duplicatesProject, getJob } from "@/server/jobs";
import { getProfile } from "@/server/profile";
import { listRepos } from "@/server/repos";
import { GeneratePanel } from "./generate-panel";

// Job analysis — design/linear.md structure (light palette) + design/jobright.md mint score ring and match chips.

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { user } = await verifySession();
  const job = await getJob(user.id, (await params).id);
  if (!job) notFound();
  const [profile, repos] = await Promise.all([getProfile(user.id), listRepos(user.id)]);

  // What each evidence id points at, so every "In profile" can be checked by the user.
  const labels = new Map<string, string>([
    ...profile.experience.map((e) => [e.id, `${e.jobTitle}, ${e.company}`] as const),
    ...profile.projects.map((p) => [p.id, p.name] as const),
    ...profile.education.map((e) => [e.id, e.institution] as const),
    ...profile.certifications.map((c) => [c.id, c.name] as const),
    ...profile.awards.map((a) => [a.id, a.name] as const),
    ...profile.skills.map((s) => [s.id, `${s.skill} (skill)`] as const),
    ...repos.map((r) => [r.id, `${r.name} (GitHub)`] as const),
  ]);

  const a = job.analysis;
  const gaps = [...a.required, ...a.niceToHave].filter((r) => !r.matched);
  const matched = a.required.filter((r) => r.matched).length;
  const meta = [job.company, a.location, a.seniority].filter(Boolean).join(" · ");

  return (
    <div className="min-h-dvh bg-ln-canvas px-4 py-8 text-ln-ink sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ln-ink-subtle hover:text-ln-ink">
          <ArrowLeft className="size-4" aria-hidden /> Applications
        </Link>

        <header className="mt-4 flex flex-col gap-6 rounded-xl border border-ln-hairline bg-ln-surface-1 p-6 sm:flex-row sm:items-center">
          <ScoreRing value={a.matchScore} size={88} track="var(--color-ln-hairline-strong)" />
          <div className="min-w-0 flex-1">
            {meta && <p className="text-[13px] font-medium tracking-[0.4px] text-ln-ink-subtle">{meta}</p>}
            <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.6px]">{job.title ?? "Untitled role"}</h1>
            <p className="mt-2 text-sm text-ln-ink-subtle">
              {a.required.length > 0 && <>Your profile backs <span className="text-ln-ink">{matched} of {a.required.length}</span> required qualifications. </>}
              {gaps.length > 0 && <>Add the missing ones you genuinely have to raise your score.</>}
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
            {a.required.length > 0 && <Panel title="Required"><RequirementList items={a.required} labels={labels} /></Panel>}
            {a.niceToHave.length > 0 && <Panel title="Nice to have"><RequirementList items={a.niceToHave} labels={labels} /></Panel>}
            {a.keywords.length > 0 && (
              <Panel title="Keywords in the posting">
                <ul className="flex flex-wrap gap-1.5">
                  {a.keywords.map((k) => <li key={k} className="rounded-md bg-ln-surface-3 px-2 py-1 font-mono text-[13px] text-ln-ink-muted">{k}</li>)}
                </ul>
              </Panel>
            )}
            <Panel title="Job description">
              <details>
                <summary className="cursor-pointer text-sm text-ln-ink-subtle hover:text-ln-ink">Show full description</summary>
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ln-ink-muted">{job.description}</p>
              </details>
            </Panel>
          </div>

          <aside className="space-y-6">
            {gaps.length > 0 && (
              <Panel title="Not found in your profile">
                <ul className="space-y-3">
                  {gaps.map((g) => (
                    <li key={g.requirement} className="rounded-lg border border-ln-hairline bg-ln-surface-2 p-3">
                      <p className="flex items-start gap-2 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-ln-ink-subtle" aria-hidden />{g.requirement}</p>
                      <p className="mt-1 pl-6 text-xs text-ln-ink-subtle">If you have this, add it to your profile. We never add it for you.</p>
                      <Link href="/profile" className="mt-2 ml-6 inline-block text-xs font-medium text-ln-primary hover:underline">Open profile →</Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <GeneratePanel jobId={job.id} profileProjects={profile.projects.map((p) => p.name)} repos={job.recommended.filter((r) => !duplicatesProject(r.name, profile.projects)).map((r) => ({ id: r.id, name: r.name, reason: r.reason }))} latestGenerationId={job.latestGeneration?.status === "ready" ? job.latestGeneration.id : null} />
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

function RequirementList({ items, labels }: { items: Requirement[]; labels: Map<string, string> }) {
  return (
    <ul className="divide-y divide-ln-hairline">
      {items.map((r) => {
        // Evidence can point at an item deleted since the analysis; only name what still exists.
        const via = r.evidence.map((e) => labels.get(e.id)).filter(Boolean).join(", ");
        return (
        <li key={r.requirement} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <span className="min-w-0">
            {r.requirement}
            {r.matched && via && <span className="mt-0.5 block text-xs text-ln-ink-subtle">via {via}</span>}
          </span>
          {r.matched ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-jr-mint px-2 py-0.5 text-xs font-medium text-black"><Check className="size-3" aria-hidden />In profile</span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ln-surface-3 px-2 py-0.5 text-xs text-ln-ink-subtle"><Minus className="size-3" aria-hidden />Missing</span>
          )}
        </li>
        );
      })}
    </ul>
  );
}
