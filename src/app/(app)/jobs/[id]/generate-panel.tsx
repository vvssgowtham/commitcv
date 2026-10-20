"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, FileText, Loader2, Sparkles } from "lucide-react";

type PanelRepo = { id: string; name: string; reason: string };

export function GeneratePanel({ repos, latestGenerationId }: { repos: PanelRepo[]; latestGenerationId: string | null }) {
  const [selected, setSelected] = useState(() => new Set(repos.map((r) => r.id)));
  const [busy] = useState(false);
  const existing = !!latestGenerationId;

  function toggle(id: string) {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setSelected(next);
  }

  // shortcut: resume generation is wired in the next PR (grounded generation + PDF); button stays disabled until then.
  const generate = () => {};

  return (
    <section className="rounded-xl border border-ln-hairline bg-ln-surface-1 p-5">
      <h2 className="text-sm font-medium text-ln-ink-muted">Projects to feature</h2>
      <p className="mt-1 text-xs text-ln-ink-subtle">Picked from your GitHub for this role. Untick to leave one out.</p>
      <ul className="mt-4 space-y-2">
        {repos.map((r) => (
          <li key={r.id}>
            <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${selected.has(r.id) ? "border-ln-hairline-strong bg-ln-surface-2" : "border-ln-hairline"}`}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-0.5 size-4 accent-ln-primary" />
              <span className="min-w-0">
                <span className="block font-mono text-[13px]">{r.name}</span>
                <span className="mt-1 block text-xs text-ln-ink-subtle">{r.reason}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {repos.length === 0 && <p className="mt-4 text-sm text-ln-ink-subtle">None of your included repositories clearly fits this role. The resume will use projects from your profile.</p>}
      <button onClick={generate} disabled
        title="Coming in the next update"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ln-primary px-3.5 py-2.5 text-sm font-medium text-white hover:bg-ln-primary-hover disabled:opacity-50">
        {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Tailoring your resume…</> : <><Sparkles className="size-4" aria-hidden /> {existing ? "Regenerate resume" : "Generate resume"}</>}
      </button>
      {existing && !busy && (
        <Link href={`/resumes/${latestGenerationId}`} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ln-hairline bg-ln-surface-2 px-3.5 py-2.5 text-sm font-medium hover:bg-ln-surface-3">
          <FileText className="size-4" aria-hidden /> Open latest resume <Check className="size-3.5 text-ln-success" aria-hidden />
        </Link>
      )}
    </section>
  );
}
