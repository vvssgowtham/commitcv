"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Link2, Loader2, Sparkles, TextCursorInput } from "lucide-react";

// New application — design/linear.md surfaces + pill tabs, design/jobright.md mint for AI progress.

const steps = ["Fetching job description", "Extracting requirements & keywords", "Matching against your profile", "Ranking your GitHub projects"];

export default function NewJob() {
  const router = useRouter();
  const [tab, setTab] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [step, setStep] = useState(-1);

  const value = tab === "url" ? url.trim() : text.trim();
  const valid = tab === "url" ? URL.canParse(value) : value.length >= 50;

  function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    // shortcut: simulated analysis that always lands on mock job j1; replace with the real analyze call.
    steps.forEach((_, i) => setTimeout(() => setStep(i), 300 + i * 650));
    setTimeout(() => router.push("/jobs/j1"), 300 + steps.length * 650);
  }

  return (
    <div className="min-h-dvh bg-ln-canvas px-4 py-8 text-ln-ink sm:px-8">
      <div className="mx-auto max-w-[720px]">
        <p className="text-[13px] font-medium tracking-[0.4px] text-ln-ink-subtle">New application</p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.6px]">What are you applying for?</h1>
        <p className="mt-2 text-ln-ink-subtle">Paste a job link or the full description. We’ll extract what matters and match it to your profile.</p>

        {step >= 0 ? (
          <div className="mt-8 rounded-xl border border-ln-hairline bg-ln-surface-1 p-6" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-ln-primary" aria-hidden /> Analyzing</p>
            <ul className="mt-5 space-y-3 text-sm">
              {steps.map((s, i) => (
                <li key={s} className={`flex items-center gap-3 ${i > step + 1 ? "text-ln-ink-tertiary" : i > step ? "text-ln-ink-muted" : ""}`}>
                  {i <= step ? (
                    <span className="grid size-5 place-items-center rounded-full bg-jr-mint text-black"><Check className="size-3" aria-hidden /></span>
                  ) : i === step + 1 ? (
                    <Loader2 className="size-5 animate-spin text-ln-ink-subtle" aria-hidden />
                  ) : (
                    <span className="size-5 rounded-full border border-ln-hairline-strong" />
                  )}
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form onSubmit={analyze} className="mt-8 rounded-xl border border-ln-hairline bg-ln-surface-1 p-4 sm:p-6">
            <div role="tablist" aria-label="Input type" className="inline-flex rounded-full border border-ln-hairline p-0.5">
              {([["url", "Job link", Link2], ["text", "Paste description", TextCursorInput]] as const).map(([k, label, Icon]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-ln-surface-3 text-ln-ink" : "text-ln-ink-subtle hover:text-ln-ink"}`}>
                  <Icon className="size-4" aria-hidden />{label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {tab === "url" ? (
                <label className="block">
                  <span className="text-xs text-ln-ink-subtle">Job posting URL</span>
                  <input type="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://company.com/careers/backend-engineer"
                    className="mt-1.5 w-full rounded-lg border border-ln-hairline bg-ln-canvas px-3 py-2.5 text-ln-ink placeholder:text-ln-ink-tertiary focus:border-ln-hairline-strong focus:outline-2 focus:outline-ln-primary-focus/50" />
                  <span className="mt-2 block text-xs text-ln-ink-tertiary">Some sites (e.g. LinkedIn) block reading. If that happens, paste the description instead.</span>
                </label>
              ) : (
                <label className="block">
                  <span className="text-xs text-ln-ink-subtle">Job description</span>
                  <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste the full job description, including requirements…"
                    className="mt-1.5 w-full resize-y rounded-lg border border-ln-hairline bg-ln-canvas px-3 py-2.5 text-sm leading-relaxed text-ln-ink placeholder:text-ln-ink-tertiary focus:border-ln-hairline-strong focus:outline-2 focus:outline-ln-primary-focus/50" />
                  <span className="mt-2 block text-xs text-ln-ink-tertiary">{text.trim().length < 50 ? `${50 - text.trim().length} more characters needed` : `${text.trim().split(/\s+/).length} words`}</span>
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={!valid} className="inline-flex items-center gap-2 rounded-lg bg-ln-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-ln-primary-hover disabled:cursor-not-allowed disabled:opacity-40">
                <Sparkles className="size-4" aria-hidden /> Analyze job
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
