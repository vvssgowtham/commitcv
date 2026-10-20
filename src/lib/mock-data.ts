// shortcut: static mock data shaped like src/db/schema.ts so the UI flows can be clicked through; replace with DB reads when the backend lands.

import type { Profile } from "./profile";
export { fmtMonth } from "./profile";

export const user = { name: "Gowtham V", email: "gowtham@example.com", image: null as string | null };

export const profile: Profile = {
  summary:
    "Full-stack engineer with 4 years building data-heavy web products in TypeScript and Python. Shipped real-time dashboards used by 20k+ analysts and cut API latency by 60% through caching and query redesign.",
  contact: { phone: "+91 98765 43210", location: "Hyderabad, India", linkedin: "linkedin.com/in/gowtham", github: "github.com/gowtham" },
  education: [
    {
      id: "ed1",
      institution: "JNTU Hyderabad",
      degree: "B.Tech",
      fieldOfStudy: "Computer Science",
      startDate: "2016-08",
      endDate: "2020-05",
      grade: "8.4 CGPA",
      description: "",
      source: "RESUME",
    },
  ],
  experience: [
    {
      id: "ex1",
      company: "Aarambha Invest",
      jobTitle: "Software Engineer II",
      employmentType: "Full-time",
      startDate: "2023-01",
      endDate: "",
      description:
        "Built portfolio analytics platform in Next.js and FastAPI serving 20k+ users\nReduced p95 API latency from 900ms to 350ms with Redis caching and query rewrites\nLed migration of 40 cron jobs to event-driven workers on AWS SQS",
      source: "RESUME",
    },
    {
      id: "ex2",
      company: "Finlytics",
      jobTitle: "Software Engineer",
      employmentType: "Full-time",
      startDate: "2020-07",
      endDate: "2022-12",
      description:
        "Developed React dashboards for real-time market data over WebSockets\nDesigned PostgreSQL schemas for 300M+ row time-series tables with partitioning",
      source: "MANUAL",
    },
  ],
  projects: [
    {
      id: "pr1",
      name: "ledger-sync",
      description: "Open-source CLI that reconciles bank statements against accounting ledgers.",
      url: "github.com/gowtham/ledger-sync",
      technologies: ["Go", "PostgreSQL"],
      source: "GITHUB",
    },
  ],
  skills: [
    { id: "s1", skill: "TypeScript", category: "Languages", source: "RESUME" },
    { id: "s2", skill: "Python", category: "Languages", source: "RESUME" },
    { id: "s3", skill: "Go", category: "Languages", source: "GITHUB" },
    { id: "s4", skill: "React", category: "Frameworks", source: "RESUME" },
    { id: "s5", skill: "Next.js", category: "Frameworks", source: "GITHUB" },
    { id: "s6", skill: "FastAPI", category: "Frameworks", source: "RESUME" },
    { id: "s7", skill: "PostgreSQL", category: "Data", source: "RESUME" },
    { id: "s8", skill: "Redis", category: "Data", source: "MANUAL" },
    { id: "s9", skill: "AWS", category: "Cloud", source: "MANUAL" },
    { id: "s10", skill: "Docker", category: "Cloud", source: "RESUME" },
  ],
  certifications: [
    {
      id: "c1",
      name: "AWS Certified Developer – Associate",
      issuingOrganization: "Amazon Web Services",
      issueDate: "2023-06",
      credentialUrl: "",
      source: "MANUAL",
    },
  ],
  awards: [
    { id: "a1", name: "Hackathon Winner — FinHack 2022", issuer: "Finlytics", date: "2022-09", description: "", source: "MANUAL" },
  ],
};


export const repos = [
  { id: "r1", name: "ledger-sync", url: "github.com/gowtham/ledger-sync", description: "Reconcile bank statements against accounting ledgers from the CLI.", languages: { Go: 82, Shell: 12, Dockerfile: 6 }, stars: 214, pushedAt: "2 days ago", isPrivate: false },
  { id: "r2", name: "realtime-ticker", url: "github.com/gowtham/realtime-ticker", description: "WebSocket market data fan-out with backpressure, 50k msgs/sec.", languages: { TypeScript: 74, Rust: 26 }, stars: 98, pushedAt: "1 week ago", isPrivate: false },
  { id: "r3", name: "portfolio-analytics", url: "github.com/gowtham/portfolio-analytics", description: "Next.js + FastAPI analytics for multi-asset portfolios.", languages: { TypeScript: 55, Python: 40, CSS: 5 }, stars: 41, pushedAt: "3 weeks ago", isPrivate: true },
  { id: "r4", name: "pg-partition-kit", url: "github.com/gowtham/pg-partition-kit", description: "Helpers for time-based partitioning on large PostgreSQL tables.", languages: { Python: 68, PLpgSQL: 32 }, stars: 37, pushedAt: "1 month ago", isPrivate: false },
  { id: "r5", name: "dotfiles", url: "github.com/gowtham/dotfiles", description: "Personal shell and editor configuration.", languages: { Shell: 90, Lua: 10 }, stars: 3, pushedAt: "2 months ago", isPrivate: false },
  { id: "r6", name: "ml-signals", url: "github.com/gowtham/ml-signals", description: "Feature pipeline and gradient-boosted models for price signals.", languages: { Python: 88, "Jupyter Notebook": 12 }, stars: 12, pushedAt: "4 months ago", isPrivate: true },
];

export type Repo = (typeof repos)[number];

export const jobs = [
  {
    id: "j1",
    url: "https://stripe.com/jobs/listing/backend-engineer-payments",
    title: "Backend Engineer, Payments",
    company: "Stripe",
    location: "Bengaluru · Hybrid",
    createdAt: "Oct 18",
    description:
      "We're looking for a backend engineer to build reliable payment infrastructure. You'll design APIs used by millions of businesses, own services end-to-end, and improve the performance of systems that move money.\n\nRequirements:\n- 3+ years building production backend services\n- Strong in Go, Java or Ruby\n- Experience with PostgreSQL and distributed systems\n- Familiarity with Kafka or other event streaming\n\nNice to have:\n- Payments or fintech experience\n- AWS, Kubernetes",
    analysis: {
      matchScore: 82,
      seniority: "Mid–Senior",
      required: [
        { skill: "Go", matched: true },
        { skill: "PostgreSQL", matched: true },
        { skill: "Distributed systems", matched: true },
        { skill: "Kafka", matched: false },
        { skill: "Production backend services", matched: true },
      ],
      niceToHave: [
        { skill: "Fintech", matched: true },
        { skill: "AWS", matched: true },
        { skill: "Kubernetes", matched: false },
      ],
      keywords: ["payments", "APIs", "reliability", "event streaming", "latency", "ownership"],
      missingInfo: [
        { field: "Kafka or event streaming experience", hint: "Your SQS migration may count — add details to Experience." },
        { field: "Kubernetes", hint: "Add it to Skills if you've deployed to a cluster." },
      ],
      recommendedRepos: [
        { repoId: "r1", reason: "Go service handling financial reconciliation — maps to payments + Go." },
        { repoId: "r2", reason: "High-throughput streaming system — evidence for event-driven design." },
        { repoId: "r4", reason: "Large PostgreSQL tables — matches the database requirement." },
      ],
    },
  },
  {
    id: "j2",
    url: null,
    title: "Senior Frontend Engineer",
    company: "Linear",
    location: "Remote",
    createdAt: "Oct 15",
    description: "Build fast, polished product UI in React and TypeScript.",
    analysis: {
      matchScore: 74,
      seniority: "Senior",
      required: [
        { skill: "React", matched: true },
        { skill: "TypeScript", matched: true },
        { skill: "Performance profiling", matched: false },
      ],
      niceToHave: [{ skill: "GraphQL", matched: false }],
      keywords: ["craft", "performance", "design systems"],
      missingInfo: [{ field: "Design-system work", hint: "Mention component libraries you've built." }],
      recommendedRepos: [{ repoId: "r3", reason: "Next.js product UI with data visualisation." }],
    },
  },
  {
    id: "j3",
    url: "https://jobs.example.com/data-platform",
    title: "Data Platform Engineer",
    company: "Razorpay",
    location: "Bengaluru",
    createdAt: "Oct 9",
    description: "Own the batch and streaming data platform.",
    analysis: {
      matchScore: 68,
      seniority: "Mid",
      required: [
        { skill: "Python", matched: true },
        { skill: "Spark", matched: false },
        { skill: "Airflow", matched: false },
      ],
      niceToHave: [{ skill: "PostgreSQL", matched: true }],
      keywords: ["pipelines", "data quality"],
      missingInfo: [{ field: "Spark / Airflow", hint: "Add any batch pipeline work." }],
      recommendedRepos: [{ repoId: "r6", reason: "Python feature pipeline." }],
    },
  },
];

export type Job = (typeof jobs)[number];

export const generations = [
  { id: "g1", jobId: "j1", atsScore: 91, createdAt: "Oct 18", status: "Ready" as const },
  { id: "g2", jobId: "j2", atsScore: 84, createdAt: "Oct 15", status: "Ready" as const },
  { id: "g3", jobId: "j3", atsScore: 0, createdAt: "Oct 9", status: "Draft" as const },
];

export const atsChecks = [
  { label: "Single-column layout, standard headings", ok: true },
  { label: "Contact info in body, not header/footer", ok: true },
  { label: "8 of 10 job keywords present", ok: true },
  { label: "Every bullet starts with an action verb", ok: true },
  { label: "Missing keyword: Kafka", ok: false },
];

export const findJob = (id: string) => jobs.find((j) => j.id === id);
export const findRepo = (id: string) => repos.find((r) => r.id === id);
export const generationForJob = (jobId: string) => generations.find((g) => g.jobId === jobId);

