import { extractLinks, extractText, getDocumentProxy } from "unpdf";
import { expect, test } from "vitest";
import type { ResumeDoc } from "@/server/generate";
import { pdfSafe, renderResumePdf } from "./pdf";

test("the PDF carries real, clickable link annotations — not just link-looking text", async () => {
  const doc: ResumeDoc = {
    header: { name: "Asha Rao", email: "asha@example.com", phone: "+91 90000 00000", location: "Hyderabad",
      links: ["https://www.linkedin.com/in/asha/", "github.com/asha"] }, // the second as stored by older resumes
    summary: "", skills: [], experience: [], education: [], certifications: [], awards: [],
    projects: [{ name: "payments-svc", url: "https://github.com/asha/payments-svc", tech: [], bullets: ["Built it."] }],
    grounding: { replacedBullets: 0, droppedBullets: 0, summaryFromProfile: true },
  };
  const pdf = new Uint8Array(await renderResumePdf(doc));
  const { links } = await extractLinks(pdf.slice());
  expect(links).toEqual(expect.arrayContaining([
    "https://www.linkedin.com/in/asha/", "https://github.com/asha", "https://github.com/asha/payments-svc",
    "mailto:asha@example.com", "tel:+919000000000",
  ]));
  const { text } = await extractText(pdf.slice(), { mergePages: true });
  expect(text).toContain("linkedin.com/in/asha"); // still printed shortened, as selectable text for ATS parsers
  expect(text).not.toContain("https://");
});

test("text is mapped to what the built-in font can draw, instead of wrong or missing glyphs", () => {
  expect(pdfSafe("Controller → Service → Repository")).toBe("Controller -> Service -> Repository");
  expect(pdfSafe("multi\u2011tenant real\u2011time")).toBe("multi-tenant real-time"); // the model's non-breaking hyphen
  expect(pdfSafe("Café — “quoted” • 2,000+ users ≥ 99% ✓")).toBe("Café — “quoted” • 2,000+ users >= 99% ");
});

test("a resume of typical length fits on one page", async () => {
  const bullets = (n: number) => Array.from({ length: n }, (_, i) => `Built a production service number ${i} with Spring Boot and Kafka, processing 2,000+ monthly calls at a 96%+ success rate under peak traffic.`);
  const doc: ResumeDoc = {
    header: { name: "Asha Rao", email: "asha@example.com", phone: "+91 90000 00000", location: "Hyderabad, India",
      links: ["https://www.linkedin.com/in/asha/", "https://github.com/asha", "https://asha.dev"] },
    summary: "Software engineer who ships features end to end: React and React Native interfaces, Node.js and Spring Boot services, SQL and NoSQL databases, and REST APIs. Built two live products used by thousands of people.",
    skills: ["Languages", "Backend & Data", "Tools & Cloud", "Frontend & Mobile", "Generative AI"].map((category) => ({ category, items: ["TypeScript", "Python", "Java", "Docker", "Kubernetes", "PostgreSQL", "Redis", "React"] })),
    experience: [3, 2, 1].map((n, i) => ({ title: "Software Development Engineer I", company: `COMPANY ${i}`, employmentType: "", startDate: "2024-06", endDate: "", bullets: bullets(n) })),
    projects: [2, 2].map((n, i) => ({ name: `Project ${i} — A Long Descriptive Project Title`, url: "https://example.com/project", tech: ["React 19", "TypeScript", "Canvas 2D", "Web Workers", "ffmpeg.wasm", "Fastify", "zod", "Docker"], bullets: bullets(n) })),
    education: [{ institution: "Sagi Ramakrishnam Raju Engineering College — Bhimavaram, India", degree: "B.Tech", fieldOfStudy: "Computer Science", startDate: "2021-10", endDate: "2025-04", grade: "CGPA: 9.25 / 10.0" }],
    certifications: [], awards: [], grounding: { replacedBullets: 0, droppedBullets: 0, summaryFromProfile: true },
  };
  const pdf = new Uint8Array(await renderResumePdf(doc));
  expect((await getDocumentProxy(pdf.slice())).numPages).toBe(1);
  const { text } = await extractText(pdf.slice(), { mergePages: true });
  expect(text).not.toMatch(/\w-\s*$/m); // no hyphenation at line ends
});
