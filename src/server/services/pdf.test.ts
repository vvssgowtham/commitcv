import { extractLinks, extractText } from "unpdf";
import { expect, test } from "vitest";
import type { ResumeDoc } from "@/server/generate";
import { renderResumePdf } from "./pdf";

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
