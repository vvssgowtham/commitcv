// Reads only what the user granted the GitHub App: repos on their installations, read-only.

export type GrantedRepo = {
  githubRepoId: number;
  name: string;
  url: string;
  description: string | null;
  languages: Record<string, number>; // percent of code, rounded, ≥1%
  topics: string[];
  readmeExcerpt: string | null;
  stars: number;
  isPrivate: boolean;
  pushedAt: Date | null;
};

export class GithubAuthError extends Error {}

const MAX_REPOS = 100;
const README_CHARS = 4000;

type Fetch = typeof fetch;

export async function fetchGrantedRepos(token: string, fetchImpl: Fetch = fetch): Promise<GrantedRepo[]> {
  async function gh<T>(path: string, accept = "application/vnd.github+json"): Promise<T | null> {
    const res = await fetchImpl(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (res.status === 401) throw new GithubAuthError("GitHub access expired");
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${path} → ${res.status}`);
    return (accept.endsWith("raw") ? await res.text() : await res.json()) as T;
  }

  type ApiRepo = { id: number; name: string; full_name: string; html_url: string; description: string | null; stargazers_count: number; private: boolean; pushed_at: string | null; topics?: string[]; fork: boolean };
  const { installations } = (await gh<{ installations: { id: number }[] }>("/user/installations?per_page=100"))!;
  const repos: ApiRepo[] = [];
  for (const inst of installations) {
    for (let page = 1; ; page++) {
      const r = (await gh<{ repositories: ApiRepo[] }>(`/user/installations/${inst.id}/repositories?per_page=100&page=${page}`))!;
      repos.push(...r.repositories);
      if (r.repositories.length < 100) break;
    }
  }
  const unique = [...new Map(repos.map((r) => [r.id, r])).values()]
    .toSorted((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, MAX_REPOS);

  return mapLimit(unique, 8, async (r) => {
    const bytes = (await gh<Record<string, number>>(`/repos/${r.full_name}/languages`)) ?? {};
    const readme = await gh<string>(`/repos/${r.full_name}/readme`, "application/vnd.github.raw");
    return {
      githubRepoId: r.id,
      name: r.name,
      url: r.html_url,
      description: r.description,
      languages: toPercent(bytes),
      topics: r.topics ?? [],
      readmeExcerpt: readme ? readme.slice(0, README_CHARS) : null,
      stars: r.stargazers_count,
      isPrivate: r.private,
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
    };
  });
}

export function toPercent(bytes: Record<string, number>) {
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  if (!total) return {};
  return Object.fromEntries(
    Object.entries(bytes).map(([k, v]) => [k, Math.round((v / total) * 100)] as const).filter(([, p]) => p >= 1).toSorted((a, b) => b[1] - a[1]),
  );
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}
