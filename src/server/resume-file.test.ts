import { createElement } from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, test } from "vitest";
import { extractPdfText, normalizeParsed, sniffResume, type ParsedResumeOutput } from "./resume-file";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("sniffResume", () => {
  test("detects by content, not name", () => {
    expect(sniffResume(bytes("%PDF-1.7 ..."))).toBe("pdf");
    expect(sniffResume(bytes("PK\x03\x04....word/document.xml...."))).toBe("docx");
    expect(sniffResume(bytes("PK\x03\x04....xl/workbook.xml"))).toBeNull(); // a zip, but not a Word file
    expect(sniffResume(bytes("<html>%PDF-"))).toBeNull();
  });
});

describe("extractPdfText", () => {
  test("leaves the original bytes usable afterward (regression: pdf.js/unpdf can detach the buffer it's given)", async () => {
    const buf = await renderToBuffer(createElement(Document, null, createElement(Page, null, createElement(Text, null, "Software Engineer with 5 years experience"))));
    const bytes = new Uint8Array(buf);

    const text = await extractPdfText(bytes);
    expect(text).toContain("Software Engineer");

    // The real bug: reusing `bytes` after parsing (e.g. to upload it) used to throw
    // "Cannot perform Construct on a detached ArrayBuffer".
    expect(() => new Uint8Array(bytes.buffer)).not.toThrow();
    expect(bytes.length).toBeGreaterThan(0);
  });
});

const empty: ParsedResumeOutput = {
  summary: "", contact: { phone: "", location: "", linkedin: "", github: "" },
  experience: [], education: [], projects: [], skills: [], certifications: [], awards: [],
};

describe("normalizeParsed", () => {
  test("keeps dates exactly as precise as written", () => {
    const out = normalizeParsed({
      ...empty,
      experience: [
        { company: "Acme", jobTitle: "Eng", employmentType: "", startDate: "2020", endDate: "Present", description: "" },
        { company: "Beta", jobTitle: "Dev", employmentType: "", startDate: "2019-13", endDate: "2021-04", description: "" },
      ],
    });
    expect(out.experience.map((e) => [e.startDate, e.endDate])).toEqual([["2020", ""], ["2019", "2021-04"]]);
  });

  test("drops nameless items, defaults skill category, normalises URLs", () => {
    const out = normalizeParsed({
      ...empty,
      experience: [{ company: " ", jobTitle: "Eng", employmentType: "", startDate: "", endDate: "", description: "" }],
      skills: [{ skill: "Go", category: "" }, { skill: "", category: "x" }],
      projects: [
        { name: "a", description: "", url: "github.com/me/a", technologies: [] },
        { name: "b", description: "", url: "not a url", technologies: ["", "Rust"] },
      ],
    });
    expect(out.experience).toEqual([]);
    expect(out.skills).toEqual([{ skill: "Go", category: "Other" }]);
    expect(out.projects.map((p) => [p.url, p.technologies])).toEqual([["https://github.com/me/a", []], ["", ["Rust"]]]);
  });
});
