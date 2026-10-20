import Link from "next/link";
import { ArrowUpRight, ChevronRight, FileText, Plus } from "lucide-react";
import { Github } from "@/components/github-icon";
import { verifySession } from "@/lib/dal";
import { listJobs } from "@/server/jobs";
import { listRepos } from "@/server/repos";

// Dashboard — design/linear.md structure (light palette): canvas → surface-1 panels with hairlines, compact 8px buttons,
// lavender only for the primary CTA, success green only for status.

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function Dashboard() {
  const { user } = await verifySession();
  const [jobs, repos] = await Promise.all([listJobs(user.id), listRepos(user.id)]);
  const ready = jobs.filter((j) => j.status === "ready").length;
  const avg = jobs.length ? Math.round(jobs.reduce((n, j) => n + j.matchScore, 0) / jobs.length) : null;

  return (
    <div className="min-h-dvh bg-ln-canvas px-4 py-8 text-ln-ink sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[13px] font-medium tracking-[0.4px] text-ln-ink-subtle">Dashboard</p>
            <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.6px]">Welcome back, {user.name.split(" ")[0]}</h1>
          </div>
          <Link href="/jobs/new" className="inline-flex items-center gap-2 self-start rounded-lg bg-ln-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-ln-primary-hover">
            <Plus className="size-4" aria-hidden /> New application
          </Link>
        </header>

        <dl className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Applications", String(jobs.length)],
            ["Avg. match score", avg === null ? "—" : `${avg}%`],
            ["Resumes ready", String(ready)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-ln-hairline bg-ln-surface-1 p-5">
              <dt className="text-xs text-ln-ink-subtle">{label}</dt>
              <dd className="mt-2 text-[28px] font-semibold tracking-[-0.6px]">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="apps-h" className="mt-10">
          <div className="flex items-center justify-between">
            <h2 id="apps-h" className="text-sm font-medium text-ln-ink-muted">Applications</h2>
            {jobs.length > 0 && <span className="text-xs text-ln-ink-tertiary">{jobs.length} total</span>}
          </div>
          {jobs.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-ln-hairline-strong bg-ln-surface-1 p-10 text-center">
              <p className="text-sm font-medium">No applications yet</p>
              <p className="mt-1 text-sm text-ln-ink-subtle">Paste a job link or description to see how your profile matches.</p>
              <Link href="/jobs/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ln-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-ln-primary-hover">
                <Plus className="size-4" aria-hidden /> New application
              </Link>
            </div>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-xl border border-ln-hairline bg-ln-surface-1">
              {jobs.map((j) => (
                <li key={j.id} className="border-b border-ln-hairline last:border-0">
                  <Link href={`/jobs/${j.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-ln-surface-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ln-surface-3 text-xs font-semibold">{(j.company ?? "?")[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{j.title ?? "Untitled role"}</p>
                      <p className="truncate text-xs text-ln-ink-subtle">{[j.company, j.location].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="hidden font-mono text-[13px] text-ln-ink-muted sm:inline">{j.matchScore}%</span>
                    <StatusBadge status={j.status} />
                    <span className="hidden w-14 text-right text-xs text-ln-ink-tertiary md:inline">{fmtDate(j.createdAt)}</span>
                    <ChevronRight className="size-4 text-ln-ink-tertiary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-2" aria-label="Setup">
          <Link href="/profile" className="group rounded-xl border border-ln-hairline bg-ln-surface-1 p-6 hover:border-ln-hairline-strong hover:bg-ln-surface-2">
            <FileText className="size-5 text-ln-ink-subtle" aria-hidden />
            <h3 className="mt-4 text-[22px] font-medium tracking-[-0.4px]">Profile</h3>
            <p className="mt-1 text-sm text-ln-ink-subtle">Keep experience, skills and projects current — every resume is built from here.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-ln-ink-muted group-hover:text-ln-ink">Edit profile <ArrowUpRight className="size-4" aria-hidden /></span>
          </Link>
          <Link href="/projects" className="group rounded-xl border border-ln-hairline bg-ln-surface-1 p-6 hover:border-ln-hairline-strong hover:bg-ln-surface-2">
            <Github className="size-5 text-ln-ink-subtle" />
            <h3 className="mt-4 text-[22px] font-medium tracking-[-0.4px]">GitHub projects</h3>
            <p className="mt-1 text-sm text-ln-ink-subtle">
              {repos.length ? `${repos.length} repositories synced. Choose which ones can appear on resumes.` : "Connect the repositories you want resumes to draw on."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-ln-ink-muted group-hover:text-ln-ink">Manage repos <ArrowUpRight className="size-4" aria-hidden /></span>
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "ready" | "failed" | null }) {
  const label = { ready: "Resume ready", pending: "Generating", failed: "Failed", none: "Analyzed" }[status ?? "none"];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ln-surface-2 px-2 py-0.5 text-xs text-ln-ink-muted">
      <span className={`size-1.5 rounded-full ${status === "ready" ? "bg-ln-success" : status === "failed" ? "bg-[#d93025]" : "bg-ln-ink-tertiary"}`} aria-hidden />
      {label}
    </span>
  );
}
