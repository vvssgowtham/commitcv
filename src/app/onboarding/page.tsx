"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, FileUp, Loader2, PenLine } from "lucide-react";
import { Github } from "@/components/github-icon";
import { Logo } from "@/components/logo";

// Onboarding — design/jobright.md (funnel continues the landing's mint/black language).

const parseSteps = ["Reading PDF", "Extracting experience & education", "Detecting skills", "Building your profile"];

export default function Onboarding() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [github, setGithub] = useState<"idle" | "connecting" | "done">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parseStep, setParseStep] = useState(-1);
  const [dragging, setDragging] = useState(false);

  function connectGithub() {
    setGithub("connecting");
    setTimeout(() => setGithub("done"), 900);
  }

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    // shortcut: simulated parse progress; swap for the real upload + parse call.
    parseSteps.forEach((_, i) => setTimeout(() => setParseStep(i), 500 + i * 700));
    setTimeout(() => router.push("/profile"), 500 + parseSteps.length * 700);
  }

  return (
    <div className="min-h-dvh bg-jr-mint-canvas">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
        <Logo />
        <Link href="/dashboard" className="text-sm font-semibold text-black/60 hover:text-black">Skip for now</Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24">
        <h1 className="font-display text-4xl font-bold md:text-6xl">Let’s build your profile</h1>
        <p className="mt-4 text-lg font-light">Everything you add here becomes the single source we tailor every resume from.</p>

        <ol className="mt-12 space-y-6">
          {/* Step 1 */}
          <li className="rounded-3xl bg-white p-6 shadow-jr-float">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <StepBadge n={1} done={github === "done"} />
              <div className="flex-1">
                <h2 className="font-display text-2xl font-semibold">Connect GitHub</h2>
                <p className="text-sm font-medium text-jr-muted">Read-only access to the repos you choose.</p>
              </div>
              <button
                onClick={connectGithub}
                disabled={github !== "idle"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-100"
              >
                {github === "connecting" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : github === "done" ? <Check className="size-4" aria-hidden /> : <Github className="size-4" aria-hidden />}
                {github === "done" ? "Connected as @gowtham" : github === "connecting" ? "Connecting…" : "Connect GitHub"}
              </button>
            </div>
          </li>

          {/* Step 2 */}
          <li className="rounded-3xl bg-white p-6 shadow-jr-float">
            <div className="flex items-center gap-4">
              <StepBadge n={2} done={parseStep === parseSteps.length - 1} />
              <div>
                <h2 className="font-display text-2xl font-semibold">Add your experience</h2>
                <p className="text-sm font-medium text-jr-muted">Upload a resume, or fill it in — your choice.</p>
              </div>
            </div>

            {file ? (
              <div className="mt-6 rounded-2xl bg-jr-soft p-5" aria-live="polite">
                <p className="font-semibold">{file.name}</p>
                <ul className="mt-4 space-y-2 text-sm font-medium">
                  {parseSteps.map((s, i) => (
                    <li key={s} className={`flex items-center gap-3 ${i > parseStep ? "text-jr-muted" : ""}`}>
                      {i <= parseStep ? (
                        <span className="grid size-5 place-items-center rounded-full bg-jr-mint"><Check className="size-3" aria-hidden /></span>
                      ) : i === parseStep + 1 ? (
                        <Loader2 className="size-5 animate-spin" aria-hidden />
                      ) : (
                        <span className="size-5 rounded-full border border-jr-hairline" />
                      )}
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
                  className={`flex flex-col items-start rounded-2xl border-2 border-dashed p-6 text-left transition ${dragging ? "border-black bg-jr-mint-canvas" : "border-jr-hairline hover:border-black"}`}
                >
                  <FileUp className="size-7" aria-hidden />
                  <span className="mt-4 font-display text-xl font-semibold">Upload resume</span>
                  <span className="mt-1 text-sm font-medium text-jr-muted">PDF or DOCX · drag & drop or click</span>
                  <span className="mt-4 rounded-full bg-jr-mint px-3 py-1 text-[13px] font-semibold">Fastest</span>
                </button>
                <input ref={fileInput} type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Upload resume file" />

                <Link href="/onboarding/manual" className="flex flex-col items-start rounded-2xl border-2 border-jr-hairline p-6 transition hover:border-black">
                  <PenLine className="size-7" aria-hidden />
                  <span className="mt-4 font-display text-xl font-semibold">Fill it in manually</span>
                  <span className="mt-1 text-sm font-medium text-jr-muted">No resume? We’ll guide you section by section.</span>
                </Link>
              </div>
            )}
          </li>
        </ol>
      </main>
    </div>
  );
}

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-lg font-bold ${done ? "bg-jr-mint" : "bg-black text-white"}`}>
      {done ? <Check className="size-5" aria-label="Done" /> : n}
    </span>
  );
}
