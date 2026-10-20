"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Lock, RefreshCw, Search, Star } from "lucide-react";
import { Github } from "@/components/github-icon";
import type { RepoRow } from "@/server/repos";
import { setIncluded as saveIncluded, syncRepos } from "@/server/actions/repos";

// GitHub projects — design/vercel.md: #fafafa canvas, hairline white cards, Geist + Geist Mono eyebrows,
// ink-only chrome, 6px app buttons, mesh gradient only in the header band.

const langColor: Record<string, string> = {
  Go: "#00add8", TypeScript: "#3178c6", Python: "#3572a5", Rust: "#dea584", Shell: "#89e051", Dockerfile: "#384d54",
  CSS: "#663399", PLpgSQL: "#336790", Lua: "#000080", "Jupyter Notebook": "#da5b0b",
};

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(d: Date | null) {
  if (!d) return "never";
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
  if (days > -1) return "today";
  if (days > -30) return rtf.format(days, "day");
  if (days > -365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

export function ProjectsView({ repos, installUrl, login }: { repos: RepoRow[]; installUrl: string; login: string }) {
  const [query, setQuery] = useState("");
  const [included, setIncluded] = useState(() => new Set(repos.filter((r) => r.included).map((r) => r.id)));
  const [syncing, startSync] = useTransition();
  const [error, setError] = useState("");

  const shown = repos.filter((r) => `${r.name} ${r.description ?? ""} ${Object.keys(r.languages ?? {}).join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  function sync() {
    setError("");
    startSync(async () => {
      const res = await syncRepos();
      if (!res.ok) setError(res.error);
    });
  }

  // First visit with nothing synced yet: pull once automatically.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (repos.length === 0 && !autoSynced.current) { autoSynced.current = true; sync(); }
  }, [repos.length]);

  async function toggle(id: string) {
    const on = !included.has(id);
    const next = new Set(included);
    if (on) next.add(id); else next.delete(id);
    setIncluded(next); // optimistic
    const res = await saveIncluded(id, on);
    if (!res.ok) { setError(res.error); setIncluded(included); }
  }

  return (
    <div className="min-h-dvh bg-vc-canvas font-geist text-vc-ink">
      <header className="relative overflow-hidden border-b border-vc-hairline bg-white">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-0 h-72 w-[36rem] opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #50e3c2, transparent), radial-gradient(closest-side at 70% 50%, #7928ca, transparent), radial-gradient(closest-side at 40% 70%, #ff0080, transparent)" }} />
        <div className="relative mx-auto max-w-[1100px] px-4 py-10 sm:px-8">
          <p className="font-mono text-xs font-medium tracking-wider text-vc-mute uppercase">GitHub projects</p>
          <h1 className="mt-2 text-[32px] leading-10 font-semibold tracking-[-1.28px]">Your repositories</h1>
          <p className="mt-2 max-w-xl text-sm text-vc-body">Included repos can be picked for tailored resumes. We only read repos you granted the Resumate GitHub App access to.</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-vc-hairline bg-white px-2.5 text-sm">
              <Github className="size-4" /> {login} <span className="size-1.5 rounded-full bg-vc-link" aria-label="Connected" />
            </span>
            <button onClick={sync} disabled={syncing}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-vc-hairline bg-white px-2.5 text-sm font-medium hover:bg-vc-hairline-soft">
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden /> {syncing ? "Syncing…" : "Sync"}
            </button>
            <a href={installUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-vc-body hover:text-vc-ink">
              Choose repositories <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <label className="relative block sm:w-80">
            <span className="sr-only">Search repositories</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-vc-faint" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repositories…"
              className="h-9 w-full rounded-md border border-vc-hairline bg-white pr-3 pl-9 text-sm placeholder:text-vc-faint focus:border-vc-mute focus:outline-none" />
          </label>
          <p className="font-mono text-xs text-vc-mute">{included.size} of {repos.length} included</p>
        </div>
        {error && <p role="alert" className="mt-4 rounded-md border border-[#ffcfcf] bg-[#fff5f5] px-3 py-2 text-sm text-[#c50000]">{error}</p>}

        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const on = included.has(r.id);
            return (
              <li key={r.id} className={`flex flex-col rounded-xl border bg-white p-6 shadow-vc-whisper transition ${on ? "border-vc-ink" : "border-vc-hairline"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 truncate text-base font-semibold tracking-[-0.3px]">
                      {r.name} {r.isPrivate && <Lock className="size-3.5 text-vc-mute" aria-label="Private" />}
                    </h2>
                    <p className="truncate font-mono text-xs text-vc-mute">{r.url.replace(/^https:\/\//, "")}</p>
                  </div>
                  <button role="switch" aria-checked={on} aria-label={`Include ${r.name}`} onClick={() => toggle(r.id)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-vc-ink" : "bg-vc-hairline"}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="mt-3 flex-1 text-sm text-vc-body">{r.description}</p>

                <div className="mt-5 flex h-1.5 overflow-hidden rounded-full" aria-hidden>
                  {Object.entries(r.languages ?? {}).map(([l, pct]) => <span key={l} style={{ width: `${pct}%`, background: langColor[l] ?? "#a1a1a1" }} />)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-vc-body">
                  {Object.entries(r.languages ?? {}).slice(0, 3).map(([l, pct]) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: langColor[l] ?? "#a1a1a1" }} aria-hidden />{l} <span className="text-vc-faint">{pct}%</span>
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-vc-hairline-soft pt-4 font-mono text-xs text-vc-mute">
                  <span className="inline-flex items-center gap-1"><Star className="size-3.5" aria-hidden />{r.stars}</span>
                  <span>Updated {ago(r.pushedAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {repos.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-vc-hairline bg-white p-10 text-center">
            <p className="text-base font-semibold">{syncing ? "Looking for repositories…" : "No repositories yet"}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-vc-body">
              Install the Resumate GitHub App and pick the repositories it may read. Access is read-only and you can change it any time.
            </p>
            <a href={installUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-9 items-center gap-2 rounded-full bg-vc-ink px-4 text-sm font-medium text-white">
              <Github className="size-4" /> Choose repositories
            </a>
            <p className="mt-3 text-xs text-vc-mute">Then come back and press Sync.</p>
          </div>
        ) : shown.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-vc-hairline bg-white p-10 text-center text-sm text-vc-mute">No repositories match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
