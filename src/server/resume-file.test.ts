import { createElement } from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import type { StructuredTextItem } from "unpdf";
import { describe, expect, test } from "vitest";
import { columnToText, extractPdfText, normalizeParsed, sniffResume, splitIntoColumns, type ParsedResumeOutput } from "./resume-file";

// Minimal item builder; only str/x/y matter to the reconstruction logic.
const item = (str: string, x: number, y: number): StructuredTextItem => ({ str, x, y, width: str.length * 6, height: 10, fontSize: 10, fontFamily: "", dir: "ltr", hasEOL: false });

const bytes = (s: string) => new TextEncoder().encode(s);

describe("sniffResume", () => {
  test("detects by content, not name", () => {
    expect(sniffResume(bytes("%PDF-1.7 ..."))).toBe("pdf");
    expect(sniffResume(bytes("PK\x03\x04....word/document.xml...."))).toBe("docx");
    expect(sniffResume(bytes("PK\x03\x04....xl/workbook.xml"))).toBeNull(); // a zip, but not a Word file
    expect(sniffResume(bytes("<html>%PDF-"))).toBeNull();
  });
});

describe("splitIntoColumns + columnToText (reading-order reconstruction)", () => {
  test("reconstructs a two-column resume even when the PDF's own stream order interleaves rows across both columns", () => {
    // Adversarial case: a generator that emits row-by-row across columns, not column-by-column.
    // This is what naive stream-order concatenation gets wrong — "Skills Software Engineer Python
    // at Google" — mixing sidebar and body on every line.
    const page = [
      item("Skills", 20, 800), item("Software Engineer", 220, 800),
      item("Python", 20, 780), item("at Google", 220, 780),
      item("SQL", 20, 760), item("Led a team of 4", 220, 760),
    ];
    const columns = splitIntoColumns(page);
    expect(columns).toHaveLength(2);
    expect(columns.map(columnToText)).toEqual(["Skills\nPython\nSQL", "Software Engineer\nat Google\nLed a team of 4"]);
  });

  test("a single item sitting further right (e.g. a page number) doesn't get mistaken for a second column", () => {
    const page = [item("Experience", 20, 800), item("Software Engineer", 20, 780), item("5+ years", 20, 760), item("2", 500, 40)];
    expect(splitIntoColumns(page)).toHaveLength(1); // not enough vertical spread on the right to count as a real column
  });

  test("columnToText sorts out-of-order items within a line and lines top to bottom", () => {
    const shuffled = [item("World", 50, 800), item("Hello", 10, 800), item("line.", 60, 780), item("Second", 10, 780)];
    expect(columnToText(shuffled)).toBe("Hello World\nSecond line.");
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
