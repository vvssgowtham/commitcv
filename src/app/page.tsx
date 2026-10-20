import { ArrowRight, Check, FileText, Link2, Plus, Sparkles } from "lucide-react";
import { Github } from "@/components/github-icon";
import { SignInButton } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";
import { ScoreRing } from "@/components/score-ring";

// Landing — design/jobright.md: mint bands, Titillium display, black pills, one green accent pill.

const tickerJobs = [
  "Backend Engineer · Stripe", "Senior Frontend Engineer · Linear", "Data Platform Engineer · Razorpay", "ML Engineer · Swiggy",
  "Platform Engineer · Atlassian", "Full-stack Developer · Zerodha", "SRE · Cloudflare", "Product Engineer · Notion",
];

const faqs = [
  { q: "Do I need an existing resume?", a: "No. Upload one and we parse it, or fill a short guided form. Both become your profile — the single source every tailored resume is built from." },
  { q: "Which GitHub repos can Resumate see?", a: "Only the ones you choose when installing our GitHub App, with read-only access. You can revoke it any time from GitHub settings." },
  { q: "Will the PDF pass applicant tracking systems?", a: "Yes. Every resume is single-column with standard section headings, real text (no images), and the job's keywords placed where they're true for you." },
  { q: "Can I paste a job link instead of the description?", a: "Yes. Paste a URL and we pull the description. If a site blocks it, paste the text instead." },
];

export default function Landing() {
  return (
    <div className="bg-white text-black">
      <header className="sticky top-0 z-20 border-b border-jr-hairline bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4" aria-label="Main">
          <Logo />
          <div className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <SignInButton className="hidden sm:inline">Sign in</SignInButton>
            <SignInButton className="rounded-[18px] bg-black px-4 py-2 text-white cursor-pointer">Get started</SignInButton>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-jr-mint-canvas px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[13px] font-medium">
              <Sparkles className="size-4 text-black" aria-hidden /> AI resume tailoring for every application
            </p>
            <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-[-1px] md:text-[80px]">
              One profile.<br />A perfect resume <span className="relative isolate whitespace-nowrap">for every job<span aria-hidden className="absolute inset-x-0 bottom-1 -z-10 h-3 bg-jr-mint md:bottom-3 md:h-4" /></span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed font-light">
              Paste a job link. Resumate reads the description, picks your strongest GitHub projects, fills the gaps, and hands you an ATS-friendly PDF in under a minute.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SignInButton className="inline-flex items-center justify-center gap-2 rounded-[28px] bg-black px-10 py-4 font-semibold text-white cursor-pointer">
                <Github className="size-5" aria-hidden /> Continue with GitHub
              </SignInButton>
              <a href="#how" className="inline-flex items-center justify-center gap-2 px-4 py-4 font-semibold">
                See how it works <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>

          {/* Product mockup card — 40px asymmetric corner */}
          <div className="rounded-[40px] rounded-tl-none bg-white p-6 shadow-jr-float">
            <div className="flex items-center gap-4 border-b border-jr-hairline pb-5">
              <ScoreRing value={91} />
              <div>
                <p className="text-[13px] font-medium text-jr-muted">Tailored for</p>
                <p className="font-display text-2xl font-bold">Backend Engineer · Stripe</p>
              </div>
            </div>
            <ul className="space-y-3 py-5 text-sm font-medium">
              {["Go, PostgreSQL, distributed systems matched", "3 GitHub projects selected", "8 of 10 job keywords placed", "Single-column, ATS-safe PDF"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid size-5 place-items-center rounded-full bg-jr-mint"><Check className="size-3" aria-hidden /></span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-jr-soft p-4 text-sm">
              <p className="font-semibold">Missing: Kafka experience</p>
              <p className="mt-1 text-jr-muted">Your SQS migration may count — add it in one click.</p>
            </div>
          </div>
        </div>

        <dl className="mx-auto mt-20 grid max-w-[1200px] gap-8 sm:grid-cols-3">
          {[["< 60s", "from job link to PDF"], ["3×", "more interview callbacks reported"], ["100%", "ATS-parsable output"]].map(([n, l]) => (
            <div key={l}>
              <dt className="font-display text-[38px] font-bold">{n}</dt>
              <dd className="text-sm font-medium text-black/70">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Job ticker */}
      <div className="overflow-hidden bg-black py-4 text-sm font-medium text-white" aria-hidden>
        <div className="flex w-max animate-marquee gap-10">
          {[...tickerJobs, ...tickerJobs].map((j, i) => (
            <span key={i} className="flex items-center gap-3 whitespace-nowrap"><span className="size-2 rounded-full bg-jr-mint" />{j}</span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="px-4 py-24">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="font-display text-4xl font-bold md:text-6xl">Three steps. Zero copy-paste.</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: FileText, t: "Build your profile", d: "Upload your resume or answer a guided form. This becomes your single source of truth." },
              { icon: Github, t: "Connect GitHub", d: "Pick the repos we can read. We rank them against each job you apply to." },
              { icon: Link2, t: "Paste a job", d: "Drop a link or the description. Get a tailored, ATS-ready PDF." },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="rounded-3xl border border-jr-hairline p-6">
                <span className="font-display text-sm font-bold text-jr-muted">0{i + 1}</span>
                <Icon className="mt-4 size-7" aria-hidden />
                <h3 className="mt-4 font-display text-[32px] leading-tight font-semibold">{t}</h3>
                <p className="mt-2 text-jr-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Feature bands */}
      <div id="features">
        <FeatureBand
          title="Understands the job like a recruiter"
          body="Required skills, nice-to-haves, seniority and keywords — extracted and matched against your profile, with clear gaps to fill."
          cta="Analyze a job"
        >
          <div className="space-y-3">
            {[["Go", true], ["PostgreSQL", true], ["Distributed systems", true], ["Kafka", false]].map(([s, ok]) => (
              <div key={s as string} className="flex items-center justify-between rounded-2xl bg-jr-soft px-4 py-3 text-sm font-semibold">
                {s}
                <span className={`rounded-full px-3 py-1 text-[13px] ${ok ? "bg-jr-mint" : "bg-black text-white"}`}>{ok ? "Matched" : "Gap"}</span>
              </div>
            ))}
          </div>
        </FeatureBand>
        <FeatureBand
          reverse
          title="Your best GitHub work, picked for you"
          body="We read languages, READMEs and activity, then choose the 2–3 projects that prove what this role asks for — and tell you why."
          cta="Connect GitHub"
        >
          <div className="space-y-3">
            {[["ledger-sync", "Go · 214★"], ["realtime-ticker", "TypeScript · 98★"], ["pg-partition-kit", "Python · 37★"]].map(([n, m]) => (
              <div key={n} className="flex items-center gap-3 rounded-2xl border border-jr-hairline px-4 py-3">
                <Github className="size-5" aria-hidden />
                <span className="font-semibold">{n}</span>
                <span className="ml-auto text-[13px] text-jr-muted">{m}</span>
              </div>
            ))}
          </div>
        </FeatureBand>
      </div>

      {/* Featured testimonial */}
      <section className="bg-black px-4 py-24 text-white">
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="font-display text-[32px] leading-tight font-semibold">
            “I stopped keeping six versions of my resume. I paste the link, check the gaps, download. Got two onsite invites the first week.”
          </blockquote>
          <figcaption className="mt-8 text-sm text-white/70">Priya S. · Backend Engineer</figcaption>
        </figure>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-jr-mint-canvas px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-4xl font-bold md:text-5xl">Questions</h2>
          <div className="mt-10 divide-y divide-jr-hairline rounded-2xl border border-jr-hairline bg-jr-mint-canvas">
            {faqs.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <Plus className="size-5 shrink-0 transition group-open:rotate-45" aria-hidden />
                </summary>
                <p className="mt-3 text-black/70">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-jr-mint-canvas px-4 pb-24">
        <div className="mx-auto max-w-[1200px] text-center">
          <h2 className="font-display text-4xl font-bold md:text-5xl">Your next application, tailored in a minute.</h2>
          <SignInButton className="mt-10 inline-flex items-center gap-2 rounded-[36px] border border-black bg-jr-mint px-12 py-3 font-semibold text-black cursor-pointer">
            Try it free <ArrowRight className="size-4" aria-hidden />
          </SignInButton>
        </div>
      </section>

      <footer className="px-4 py-16 text-sm font-medium text-jr-muted">
        <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <Logo />
          <p>© 2026 Resumate AI</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureBand({ title, body, cta, reverse, children }: { title: string; body: string; cta: string; reverse?: boolean; children: React.ReactNode }) {
  return (
    <section className="bg-jr-mint-canvas px-4 py-24 [&+&]:pt-0">
      <div className={`mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <h2 className="font-display text-4xl leading-tight font-bold md:text-5xl">{title}</h2>
          <p className="mt-6 text-lg font-light">{body}</p>
          <SignInButton className="mt-8 inline-flex rounded-[28px] bg-black px-10 py-4 font-semibold text-white cursor-pointer">{cta}</SignInButton>
        </div>
        <div className="rounded-[40px] rounded-tl-none bg-white p-6 shadow-jr-float">{children}</div>
      </div>
    </section>
  );
}
