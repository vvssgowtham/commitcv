// Grounding: model output may only *point at* data the user owns. Anything it can't back with a real,
// owned id is dropped here, before it is stored or shown. Pure functions, unit-tested.

export const evidenceKinds = ["experience", "project", "education", "certification", "award", "skill", "repo"] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];
export type Evidence = { kind: EvidenceKind; id: string };

/** Ids the user owns, per kind. `repo` holds only repos the user included. */
export type OwnedIds = Record<EvidenceKind, Set<string>>;

type RawRequirement = { requirement: string; evidence: Evidence[] };
export type RawAnalysis = {
  title: string; company: string; location: string; seniority: string;
  required: RawRequirement[]; niceToHave: RawRequirement[]; keywords: string[];
  recommendedRepos: { repoId: string; reason: string }[];
};

export type Requirement = { requirement: string; evidence: Evidence[]; matched: boolean };
export type JobAnalysis = {
  location: string; seniority: string;
  required: Requirement[]; niceToHave: Requirement[]; keywords: string[];
  recommendedRepos: { repoId: string; reason: string }[];
  matchScore: number;
};

const clean = (s: string, max: number) => s.trim().slice(0, max);

function groundRequirements(list: RawRequirement[], owned: OwnedIds): Requirement[] {
  const seen = new Set<string>();
  return list
    .map((r) => ({ requirement: clean(r.requirement, 200), evidence: r.evidence }))
    .filter((r) => r.requirement && !seen.has(r.requirement.toLowerCase()) && seen.add(r.requirement.toLowerCase()))
    .slice(0, 25)
    .map((r) => {
      const evidence = r.evidence.filter((e, i, all) => owned[e.kind]?.has(e.id) && all.findIndex((x) => x.kind === e.kind && x.id === e.id) === i);
      return { requirement: r.requirement, evidence, matched: evidence.length > 0 };
    });
}

/** Required skills weigh 80%, nice-to-haves 20% (all 100% on required when there are none). */
export function matchScore(required: Requirement[], niceToHave: Requirement[]) {
  const ratio = (l: Requirement[]) => l.filter((r) => r.matched).length / l.length;
  if (!required.length && !niceToHave.length) return 0;
  if (!niceToHave.length) return Math.round(100 * ratio(required));
  if (!required.length) return Math.round(100 * ratio(niceToHave));
  return Math.round(100 * (0.8 * ratio(required) + 0.2 * ratio(niceToHave)));
}

export function groundAnalysis(raw: RawAnalysis, owned: OwnedIds): JobAnalysis {
  const required = groundRequirements(raw.required, owned);
  const niceToHave = groundRequirements(raw.niceToHave, owned);
  const repoIds = new Set<string>();
  const recommendedRepos = raw.recommendedRepos
    .filter((r) => owned.repo.has(r.repoId) && !repoIds.has(r.repoId) && repoIds.add(r.repoId))
    .slice(0, 3)
    .map((r) => ({ repoId: r.repoId, reason: clean(r.reason, 240) }));
  return {
    location: clean(raw.location, 120),
    seniority: clean(raw.seniority, 60),
    required, niceToHave,
    keywords: [...new Set(raw.keywords.map((k) => clean(k, 60)).filter(Boolean))].slice(0, 20),
    recommendedRepos,
    matchScore: matchScore(required, niceToHave),
  };
}
