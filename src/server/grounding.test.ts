import { describe, expect, test } from "vitest";
import { groundAnalysis, matchScore, type OwnedIds, type RawAnalysis } from "./grounding";

const owned: OwnedIds = {
  experience: new Set(["exp1"]), project: new Set(), education: new Set(), certification: new Set(),
  award: new Set(), skill: new Set(["go"]), repo: new Set(["repo1", "repo2"]),
};

const raw = (over: Partial<RawAnalysis> = {}): RawAnalysis => ({
  title: "Backend Engineer", company: "Acme", location: "Remote", seniority: "Senior",
  required: [], niceToHave: [], keywords: [], recommendedRepos: [], ...over,
});

describe("groundAnalysis", () => {
  test("a requirement is matched only by evidence the user owns", () => {
    const a = groundAnalysis(raw({
      required: [
        { requirement: "Go", evidence: [{ kind: "skill", id: "go" }] },
        { requirement: "Kafka", evidence: [{ kind: "experience", id: "someone-elses" }] }, // invented id
        { requirement: "Kubernetes", evidence: [{ kind: "skill", id: "exp1" }] }, // real id, wrong kind
      ],
    }), owned);
    expect(a.required.map((r) => [r.requirement, r.matched])).toEqual([["Go", true], ["Kafka", false], ["Kubernetes", false]]);
    expect(a.required[1].evidence).toEqual([]);
  });

  test("recommended repos must be the user's included repos, max 3, no duplicates", () => {
    const a = groundAnalysis(raw({
      recommendedRepos: [
        { repoId: "repo1", reason: "fits" }, { repoId: "repo1", reason: "dup" },
        { repoId: "not-mine", reason: "x" }, { repoId: "repo2", reason: "also" },
      ],
    }), owned);
    expect(a.recommendedRepos.map((r) => r.repoId)).toEqual(["repo1", "repo2"]);
  });

  test("dedupes requirements and keywords", () => {
    const a = groundAnalysis(raw({
      required: [{ requirement: "Go", evidence: [] }, { requirement: "go ", evidence: [] }],
      keywords: ["APIs", "APIs", " "],
    }), owned);
    expect(a.required).toHaveLength(1);
    expect(a.keywords).toEqual(["APIs"]);
  });
});

test("matchScore weights required 80 / nice 20 and handles empty lists", () => {
  const r = (matched: boolean) => ({ requirement: String(Math.random()), evidence: [], matched });
  expect(matchScore([r(true), r(false)], [r(true)])).toBe(60);
  expect(matchScore([r(true), r(false)], [])).toBe(50);
  expect(matchScore([], [])).toBe(0);
});
