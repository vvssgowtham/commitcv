import { gzipSync } from "node:zlib";
import { Header } from "tar";
import { describe, expect, test } from "vitest";
import { addedRanges, chunkRepo, cleanPath, keepForkWork, manifestDependencies, readTarball, repoFacts, searchText, wanted, type ForkWork } from "./repo-index";

// A real (gzipped) tar archive, built with tar's own header encoder, wrapped the way GitHub wraps it.
type Entry = { path: string; body?: string | Buffer; type?: "File" | "SymbolicLink" | "Directory"; linkpath?: string };
function tarball(entries: Entry[]) {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const body = typeof e.body === "string" ? Buffer.from(e.body) : (e.body ?? Buffer.alloc(0));
    const h = new Header({ path: e.path, size: e.type && e.type !== "File" ? 0 : body.length, type: e.type ?? "File", linkpath: e.linkpath, mode: 0o644, mtime: new Date(0) });
    const block = Buffer.alloc(512);
    h.encode(block);
    blocks.push(block);
    if (!e.type || e.type === "File") blocks.push(body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}
async function* stream(buf: Buffer) { for (let i = 0; i < buf.length; i += 4096) yield buf.subarray(i, i + 4096); }

describe("archive safety", () => {
  test("cleanPath drops GitHub's wrapper dir and rejects traversal, absolute and empty segments", () => {
    expect(cleanPath("me-repo-abc123/src/app.ts")).toBe("src/app.ts");
    expect(cleanPath("me-repo-abc123/../../etc/passwd")).toBeNull();
    expect(cleanPath("me-repo-abc123/src/../../x.ts")).toBeNull();
    expect(cleanPath("me-repo-abc123//etc/x")).toBeNull();
    expect(cleanPath("me-repo-abc123/")).toBeNull();
  });

  test("reads only regular, wanted, small, text files — never symlinks, vendored code or binaries", async () => {
    const files = [
      { path: "r-1/README.md", body: "# Repo\nA payments service." },
      { path: "r-1/src/pay.ts", body: "export const pay = () => 1;" },
      { path: "r-1/src/link.ts", type: "SymbolicLink" as const, linkpath: "/etc/passwd" },
      { path: "r-1/../../evil.ts", body: "export const evil = 1;" },
      { path: "r-1/node_modules/x/index.js", body: "module.exports = 1" },
      { path: "r-1/package-lock.json", body: "{}" },
      { path: "r-1/src/blob.ts", body: Buffer.from([0x65, 0x00, 0x66]) },
      { path: "r-1/src/huge.ts", body: "x".repeat(210 * 1024) },
      { path: "r-1/logo.png", body: "png" },
    ];
    const { files: read, paths } = await readTarball(stream(tarball(files)));
    expect(read.map((f) => f.path).sort()).toEqual(["README.md", "src/pay.ts"]);
    expect(paths).not.toContain("src/link.ts"); // symlinks aren't files
    expect(paths).not.toContain("node_modules/x/index.js");
    expect(paths.some((p) => p.includes(".."))).toBe(false);
  });

  test("wanted() keeps code, docs, manifests and infra; skips generated and lock files", () => {
    for (const p of ["src/a.ts", "app/page.tsx", "main.py", "README.md", "docs/x.md", "package.json", "Dockerfile", ".github/workflows/ci.yml", "infra/main.tf"]) expect(wanted(p)).toBe(true);
    for (const p of ["dist/a.js", "a.min.js", "a.js.map", "yarn.lock", "types.d.ts", "logo.svg", "build/x.py"]) expect(wanted(p)).toBe(false);
  });
});

describe("facts", () => {
  test("dependencies from each manifest format", () => {
    expect(manifestDependencies("package.json", JSON.stringify({ dependencies: { next: "1" }, devDependencies: { vitest: "1" } }))).toEqual(["next", "vitest"]);
    expect(manifestDependencies("requirements.txt", "fastapi>=0.1\n# c\nuvicorn[standard]==1\n-r other.txt\n")).toEqual(["fastapi", "uvicorn"]);
    expect(manifestDependencies("pyproject.toml", '[project]\ndependencies = [\n  "httpx>=0.2",\n  "pydantic",\n]\n')).toEqual(["httpx", "pydantic"]);
    expect(manifestDependencies("pyproject.toml", '[tool.poetry.dependencies]\npython = "^3.11"\ndjango = "^5"\n\n[tool.x]\n')).toEqual(["django"]);
    expect(manifestDependencies("pom.xml", "<dependency><groupId>org.springframework</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>")).toEqual(["spring-boot-starter-web"]);
    expect(manifestDependencies("build.gradle", "implementation 'org.apache.kafka:kafka-clients:3.6.0'")).toEqual(["kafka-clients"]);
    expect(manifestDependencies("go.mod", "module x\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n")).toEqual(["github.com/gin-gonic/gin"]);
    expect(manifestDependencies("Cargo.toml", "[dependencies]\ntokio = { version = \"1\" }\nserde = \"1\"\n")).toEqual(["tokio", "serde"]);
    expect(manifestDependencies("package.json", "{not json")).toEqual([]);
  });

  test("infra and tests come from paths, even for files that aren't read", () => {
    const f = repoFacts([{ path: "package.json", text: JSON.stringify({ dependencies: { fastify: "1" } }) }],
      ["package.json", "Dockerfile", ".github/workflows/ci.yml", "infra/main.tf", "k8s/deploy.yaml", "src/a.test.ts"]);
    expect(f).toEqual({ dependencies: ["fastify"], infra: ["Docker", "Terraform", "GitHub Actions", "Kubernetes"], files: 6, hasTests: true });
  });
});

describe("chunks", () => {
  const code = Array.from({ length: 200 }, (_, i) => (i % 20 === 0 ? `export function f${i}() {` : `  const v${i} = ${i};`)).join("\n");

  test("code chunks cover the file with exact lines and real line numbers", () => {
    const chunks = chunkRepo([{ path: "src/a.ts", text: code }]);
    const lines = code.split("\n");
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.text).toBe(lines.slice(c.startLine - 1, c.endLine).join("\n"));
      expect(c.endLine - c.startLine + 1).toBeLessThanOrEqual(60);
    }
    expect(chunks[0].startLine).toBe(1);
    expect(chunks.at(-1)!.endLine).toBe(200);
    expect(chunks.every((c, i) => i === 0 || c.startLine === chunks[i - 1].endLine + 1)).toBe(true);
    expect(chunks.slice(1).every((c) => /^export function/.test(c.text))).toBe(true); // cuts land on declarations
  });

  test("markdown splits at headings; manifests and infra aren't chunked; README ranks first", () => {
    const chunks = chunkRepo([
      { path: "src/x.ts", text: "export const x = 'some code that is long enough to keep';" },
      { path: "package.json", text: JSON.stringify({ name: "a long enough manifest body to chunk if it were" }) },
      { path: "README.md", text: "# Title\nIntro paragraph long enough to be kept as a chunk.\n## Setup\nRun the install command and then the dev server." },
    ]);
    expect(chunks.map((c) => [c.path, c.kind, c.startLine])).toEqual([["README.md", "readme", 1], ["README.md", "readme", 3], ["src/x.ts", "code", 1]]);
  });

  test("a large docs folder can't crowd out the code", () => {
    const docs = Array.from({ length: 80 }, (_, i) => ({ path: `docs/d${i}.md`, text: `# D${i}\n${"word ".repeat(400)}` }));
    const chunks = chunkRepo([...docs, { path: "src/a.ts", text: code }]);
    expect(chunks.filter((c) => c.kind === "doc").reduce((n, c) => n + c.text.length, 0)).toBeLessThanOrEqual(50_000);
    expect(chunks.some((c) => c.kind === "code")).toBe(true);
  });

  test("fork work: added line ranges from a diff, and only chunks overlapping them", () => {
    expect(addedRanges("@@ -10,3 +12,4 @@ fn\n x\n+y\n@@ -40 +44 @@\n+z\n@@ -50,2 +55,0 @@\n-gone")).toEqual([[12, 15], [44, 44]]);
    const c = (path: string, startLine: number, endLine: number) => ({ path, startLine, endLine, kind: "code" as const, text: "t", contentHash: path + startLine });
    const chunks = [c("a.ts", 1, 30), c("a.ts", 31, 60), c("new.ts", 1, 10), c("other.ts", 1, 5)];
    const work: ForkWork = new Map();
    work.set("a.ts", [[40, 41]]).set("new.ts", "all");
    expect(keepForkWork(chunks, work).map((x) => `${x.path}:${x.startLine}`)).toEqual(["a.ts:31", "new.ts:1"]);
  });

  test("resume/CV documents inside a repo aren't indexed — they describe the person, not the repo", () => {
    for (const p of ["resume.md", "docs/my-resume.md", "gowtham-resume.md", "CV.md", "cv-2025.md"]) expect(wanted(p)).toBe(false);
    for (const p of ["docs/resume-parsing.md", "src/resume-parser.ts", "resume-builder.md"]) expect(wanted(p)).toBe(true);
  });

  test("searchText splits identifiers so exact names are findable", () => {
    const t = searchText({ path: "src/razorpay_webhook.ts", text: "verifyRazorpaySignature()" });
    expect(t).toMatch(/\bverify Razorpay Signature\b/);
    expect(t).toMatch(/\brazorpay webhook\b/);
  });
});
