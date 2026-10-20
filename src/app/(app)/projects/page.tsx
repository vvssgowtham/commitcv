"use client";

import { useState } from "react";
import { Lock, RefreshCw, Search, Star } from "lucide-react";
import { Github } from "@/components/github-icon";
import { repos } from "@/lib/mock-data";

// GitHub projects — design/vercel.md: #fafafa canvas, hairline white cards, Geist + Geist Mono eyebrows,
// ink-only chrome, 6px app buttons, mesh gradient only in the header band.

const langColor: Record<string, string> = {
  Go: "#00add8", TypeScript: "#3178c6", Python: "#3572a5", Rust: "#dea584", Shell: "#89e051", Dockerfile: "#384d54",
  CSS: "#663399", PLpgSQL: "#336790", Lua: "#000080", "Jupyter Notebook": "#da5b0b",
};

export default function Projects() {
  const [query, setQuery] = useState("");
  const [included, setIncluded] = useState(() => new Set(repos.filter((r) => r.stars > 10).map((r) => r.id)));
  const [syncing, setSyncing] = useState(false);

  const shown = repos.filter((r) => `${r.name} ${r.description} ${Object.keys(r.languages).join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: string) {
    const next = new Set(included);
    if (!next.delete(id)) next.add(id);
    setIncluded(next);
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
              <Github className="size-4" /> @gowtham <span className="size-1.5 rounded-full bg-vc-link" aria-label="Connected" />
            </span>
            <button onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 1200); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-vc-hairline bg-white px-2.5 text-sm font-medium hover:bg-vc-hairline-soft">
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden /> {syncing ? "Syncing…" : "Sync"}
            </button>
            <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md px-2.5 text-sm text-vc-body hover:text-vc-ink">
              Manage access ↗
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
                    <p className="truncate font-mono text-xs text-vc-mute">{r.url}</p>
                  </div>
                  <button role="switch" aria-checked={on} aria-label={`Include ${r.name}`} onClick={() => toggle(r.id)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-vc-ink" : "bg-vc-hairline"}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="mt-3 flex-1 text-sm text-vc-body">{r.description}</p>

                <div className="mt-5 flex h-1.5 overflow-hidden rounded-full" aria-hidden>
                  {Object.entries(r.languages).map(([l, pct]) => <span key={l} style={{ width: `${pct}%`, background: langColor[l] ?? "#a1a1a1" }} />)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-vc-body">
                  {Object.entries(r.languages).slice(0, 3).map(([l, pct]) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: langColor[l] ?? "#a1a1a1" }} aria-hidden />{l} <span className="text-vc-faint">{pct}%</span>
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-vc-hairline-soft pt-4 font-mono text-xs text-vc-mute">
                  <span className="inline-flex items-center gap-1"><Star className="size-3.5" aria-hidden />{r.stars}</span>
                  <span>Updated {r.pushedAt}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-vc-hairline bg-white p-10 text-center text-sm text-vc-mute">No repositories match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
