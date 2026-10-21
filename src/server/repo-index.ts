import { createHash } from "node:crypto";
import { Parser, type ReadEntry } from "tar";
import type { RepoFacts } from "@/db/schema";
import { splitIdentifiers } from "@/server/resume-grounding";

// Turning a GitHub tarball into facts and retrievable chunks. Pure apart from reading the stream:
// nothing is written to disk, so archive paths are only ever labels, never filesystem targets.

export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 300 * 1024 * 1024; // zip-bomb guard: stop reading, whatever we've kept
const MAX_FILE_BYTES = 200 * 1024;
// Text kept per repo for chunking/embedding. ~70k tokens, so ~40 repos fit Workers AI's free day.
const MAX_INDEXED_CHARS = 200_000;
const README_CHARS = 30_000;
const DOC_CHARS = 50_000;

export type RepoFile = { path: string; text: string };
export type Chunk = { path: string; startLine: number; endLine: number; kind: "readme" | "doc" | "code"; text: string; contentHash: string };

const SKIP_DIRS = /(^|\/)(node_modules|dist|build|out|\.next|\.nuxt|vendor|coverage|\.git|target|__pycache__|\.venv|venv|bin|obj|\.turbo|\.cache)\//;
const LOCKFILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|poetry\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/;
const GENERATED = /\.(min\.(js|css)|map|snap|d\.ts)$/;
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|py|java|kt|kts|go|rs|rb|php|cs|swift|scala|sql|prisma|graphql|gql|vue|svelte|html|sh)$/i;
const MANIFEST = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|pom\.xml|build\.gradle(\.kts)?|go\.mod|Cargo\.toml)$/;
const INFRA = /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|[^/]+\.tf|Chart\.yaml|vercel\.json|netlify\.toml|fly\.toml|\.github\/workflows\/[^/]+\.ya?ml)$/;
const MARKDOWN = /\.(md|mdx)$/i;
const TEST = /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[a-z]+$/i;

// A copy of the person's resume inside a repo describes them, not the repo; indexing it would let a
// bullet credit the repo with their employer's work.
const RESUME_NAME = "([\\w-]*[-_])?(resume|cv|curriculum[-_]?vitae)([-_]?\\d{2,4})?";
const RESUME_DOC = new RegExp(`(^|/)(${RESUME_NAME}\\.(md|mdx|html?|tex|txt|json|ya?ml)|data/${RESUME_NAME}\\.[jt]sx?)$`, "i");

/** Is this archive path worth reading at all? */
export function wanted(path: string) {
  if (SKIP_DIRS.test(path) || LOCKFILES.test(path) || GENERATED.test(path) || RESUME_DOC.test(path)) return false;
  return CODE.test(path) || MANIFEST.test(path) || INFRA.test(path) || MARKDOWN.test(path);
}

/** GitHub tarballs wrap everything in "owner-repo-sha/". Returns null for anything unsafe or odd. */
export function cleanPath(raw: string) {
  const path = raw.replace(/^[^/]+\//, "");
  if (!path || path.startsWith("/") || path.split("/").some((p) => p === ".." || p === "")) return null;
  return path;
}

/** Read the wanted text files out of a (gzipped) tarball stream, with size guards. */
export async function readTarball(body: AsyncIterable<Uint8Array>): Promise<{ files: RepoFile[]; paths: string[] }> {
  const files: RepoFile[] = [];
  const paths: string[] = []; // every regular file outside skipped dirs, read or not: for infra/test facts
  let unpacked = 0;
  let downloaded = 0;
  let stopped = false;
  const parser = new Parser({
    onReadEntry: (entry: ReadEntry) => {
      // Only regular files: symlinks and hard links could point anywhere, so they're never followed.
      const path = entry.type === "File" || entry.type === "OldFile" ? cleanPath(entry.path) : null;
      if (path && !SKIP_DIRS.test(path)) paths.push(path);
      if (stopped || !path || !wanted(path) || entry.size > MAX_FILE_BYTES) return entry.resume();
      const parts: Buffer[] = [];
      entry.on("data", (d: Buffer) => parts.push(d));
      entry.on("end", () => {
        const bytes = Buffer.concat(parts);
        unpacked += bytes.length;
        if (unpacked > MAX_UNPACKED_BYTES) stopped = true;
        if (!bytes.subarray(0, 8000).includes(0)) files.push({ path, text: bytes.toString("utf8") }); // NUL ⇒ binary
      });
    },
  });
  const done = new Promise<void>((resolve, reject) => { parser.on("end", resolve); parser.on("error", reject); });
  for await (const chunk of body) {
    downloaded += chunk.length;
    if (downloaded > MAX_DOWNLOAD_BYTES) throw new Error("Repository archive is larger than 50 MB");
    parser.write(Buffer.from(chunk));
    if (stopped) break;
  }
  parser.end();
  await done;
  return { files, paths };
}

// ---------- Facts: exact, from the repo's own files ----------

const unique = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** Dependency names declared in one manifest. Unparseable manifests contribute nothing. */
export function manifestDependencies(path: string, text: string): string[] {
  const name = path.split("/").at(-1)!;
  try {
    if (name === "package.json") {
      const j = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
      return Object.keys({ ...j.dependencies, ...j.devDependencies, ...j.peerDependencies });
    }
    if (name === "requirements.txt") {
      return text.split("\n").map((l) => l.replace(/#.*/, "").trim()).filter((l) => l && !l.startsWith("-")).map((l) => l.split(/[<>=~!;\[\s]/)[0]);
    }
    if (name === "pyproject.toml") {
      const list = text.match(/^dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1] ?? "";
      const poetry = text.match(/^\[tool\.poetry\.dependencies\]([\s\S]*?)(^\[|$(?![\s\S]))/m)?.[1] ?? "";
      return [
        ...[...list.matchAll(/["']([A-Za-z0-9_.\-]+)/g)].map((m) => m[1]),
        ...[...poetry.matchAll(/^([A-Za-z0-9_.\-]+)\s*=/gm)].map((m) => m[1]).filter((d) => d !== "python"),
      ];
    }
    if (name === "pom.xml") return [...text.matchAll(/<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>/g)].map((m) => m[1]);
    if (name.startsWith("build.gradle")) return [...text.matchAll(/(?:implementation|api|compileOnly|runtimeOnly)\s*\(?\s*["'][^:"']+:([^:"']+)/g)].map((m) => m[1]);
    if (name === "go.mod") return [...text.matchAll(/^\s*(?:require\s+)?([a-z0-9.\-]+\.[a-z]{2,}\/[^\s]+)\s+v[0-9]/gm)].map((m) => m[1]);
    if (name === "Cargo.toml") {
      const deps = text.match(/^\[dependencies\]([\s\S]*?)(^\[|$(?![\s\S]))/m)?.[1] ?? "";
      return [...deps.matchAll(/^([A-Za-z0-9_\-]+)\s*=/gm)].map((m) => m[1]);
    }
  } catch {
    return [];
  }
  return [];
}

const INFRA_LABELS: [RegExp, string][] = [
  [/(^|\/)Dockerfile/, "Docker"],
  [/(^|\/)(docker-compose[^/]*|compose)\.ya?ml$/, "Docker Compose"],
  [/\.tf$/, "Terraform"],
  [/(^|\/)Chart\.yaml$/, "Helm"],
  [/^\.github\/workflows\//, "GitHub Actions"],
  [/(^|\/)vercel\.json$/, "Vercel"],
  [/(^|\/)netlify\.toml$/, "Netlify"],
  [/(^|\/)fly\.toml$/, "Fly.io"],
  [/(^|\/)(k8s|kubernetes)\//, "Kubernetes"],
];

export function repoFacts(files: RepoFile[], paths: string[]): RepoFacts {
  return {
    dependencies: unique(files.filter((f) => MANIFEST.test(f.path)).flatMap((f) => manifestDependencies(f.path, f.text))).sort(),
    infra: INFRA_LABELS.filter(([re]) => paths.some((p) => re.test(p))).map(([, label]) => label),
    files: paths.length,
    hasTests: paths.some((p) => TEST.test(p)),
  };
}

// ---------- Chunks ----------

const CHUNK_CHARS = 1800;
const CHUNK_LINES = 60;
// A line that starts a new top-level declaration — where it's natural to cut code.
const DECLARATION = /^(export |async |function |class |def |public |private |protected |internal |interface |type |enum |const |let |var |func |fn |impl |struct |module |package |@|router\.|app\.)/;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function chunkMarkdown(path: string, text: string, kind: "readme" | "doc"): Chunk[] {
  const lines = text.split("\n");
  const out: Chunk[] = [];
  let start = 0;
  const flush = (end: number) => {
    const body = lines.slice(start, end).join("\n").trim();
    if (body.length >= 40) out.push({ path, startLine: start + 1, endLine: end, kind, text: body.slice(0, CHUNK_CHARS * 2), contentHash: hash(path + body) });
    start = end;
  };
  lines.forEach((l, i) => {
    const size = lines.slice(start, i).join("\n").length;
    if (i > start && (/^#{1,3}\s/.test(l) || size > CHUNK_CHARS)) flush(i);
  });
  flush(lines.length);
  return out;
}

function chunkCode(path: string, text: string): Chunk[] {
  const lines = text.split("\n");
  const out: Chunk[] = [];
  let start = 0;
  const flush = (end: number) => {
    const body = lines.slice(start, end).join("\n");
    if (body.trim().length >= 40) out.push({ path, startLine: start + 1, endLine: end, kind: "code", text: body, contentHash: hash(path + body) });
    start = end;
  };
  for (let i = 1; i < lines.length; i++) {
    const length = i - start;
    const size = lines.slice(start, i).join("\n").length;
    const atBoundary = DECLARATION.test(lines[i]) || (lines[i - 1].trim() === "" && !/^\s/.test(lines[i]));
    // Prefer cutting at a declaration; force a cut when a chunk gets too long regardless.
    if ((atBoundary && (length >= CHUNK_LINES / 2 || size >= CHUNK_CHARS / 2)) || length >= CHUNK_LINES || size >= CHUNK_CHARS) flush(i);
  }
  flush(lines.length);
  return out;
}

// What gets indexed first when a repo has more text than the budget: docs, then app code, then tests.
function priority(path: string) {
  if (/^readme\.(md|mdx)$/i.test(path)) return 0;
  if (MARKDOWN.test(path)) return 1;
  if (TEST.test(path)) return 4;
  if (/(^|\/)(src|app|server|api|lib|routes|models|services|controllers|pages|components)\//.test(path)) return 2;
  return 3;
}

/** Chunks to embed, most informative files first, within the per-repo text budget. Manifests and infra
 * files are already captured exactly as facts, so they aren't chunked. */
export function chunkRepo(files: RepoFile[]): Chunk[] {
  // Each kind has its own share, so a large docs/ folder can't crowd out the code itself.
  const left = { readme: README_CHARS, doc: DOC_CHARS, total: MAX_INDEXED_CHARS };
  const out: Chunk[] = [];
  for (const f of files.toSorted((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path))) {
    if (MANIFEST.test(f.path) || INFRA.test(f.path)) continue;
    const chunks = MARKDOWN.test(f.path) ? chunkMarkdown(f.path, f.text, /^readme\./i.test(f.path.split("/").at(-1)!) ? "readme" : "doc") : chunkCode(f.path, f.text);
    for (const c of chunks) {
      if (c.text.length > left.total) return out;
      if (c.kind !== "code") {
        if (c.text.length > left[c.kind]) break; // rest of this file is over its kind's share
        left[c.kind] -= c.text.length;
      }
      left.total -= c.text.length;
      out.push(c);
    }
  }
  return out;
}

/** Line ranges (in the new file) that a unified-diff patch added or changed. Pure deletions add nothing. */
export function addedRanges(patch: string): [number, number][] {
  return [...patch.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)]
    .map((m) => [Number(m[1]), Number(m[1]) + Number(m[2] ?? 1) - 1] as [number, number])
    .filter(([a, b]) => b >= a);
}

/** A fork's own work: whole files it added, and only the changed lines of files it modified. */
export type ForkWork = Map<string, "all" | [number, number][]>;

export function keepForkWork(chunks: Chunk[], work: ForkWork) {
  return chunks.filter((c) => {
    const w = work.get(c.path);
    return w === "all" || (!!w && w.some(([a, b]) => c.startLine <= b && c.endLine >= a));
  });
}

/** Text for the full-text index: the chunk plus its identifiers split into words, so a search for
 * "Razorpay" finds `verifyRazorpaySignature` and `razorpay_webhook`. */
export const searchText = (c: Pick<Chunk, "path" | "text">) => {
  const both = `${c.path}\n${c.text}`;
  return `${both}\n${splitIdentifiers(both)}`;
};

/** What the embedding model sees: the path gives a chunk its context ("payments/webhook.ts"). */
export const embeddingInput = (c: Pick<Chunk, "path" | "text">) => `${c.path}\n${c.text}`;
