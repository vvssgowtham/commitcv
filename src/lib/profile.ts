import { z } from "zod";

// The candidate profile as the editor and server exchange it. Shared by client and server:
// the editor's state, the save action's input validation, and the resume-merge logic all use it.
// Empty values are "" (never null) so comparisons don't flip between null and "".

export const sourceTypes = ["RESUME", "MANUAL", "GITHUB", "USER_EDIT"] as const;
export type SourceType = (typeof sourceTypes)[number];

// "YYYY", "YYYY-MM" or "" (unknown / present). Year-only stays year-only: we never invent a month.
const month = z.union([z.literal(""), z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Use YYYY or YYYY-MM, e.g. 2024-03")]);
const text = (max = 500) => z.string().trim().max(max);
const url = z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(500)]);
const item = { id: z.string().min(1).max(64), source: z.enum(sourceTypes) };

export const profileSchema = z.object({
  summary: text(2000),
  contact: z.object({ phone: text(40), location: text(120), linkedin: text(200), github: text(200), portfolio: text(200) }),
  experience: z.array(z.object({
    ...item, company: text(120).min(1, "Company is required"), jobTitle: text(120).min(1, "Job title is required"),
    employmentType: text(60), startDate: month, endDate: month, description: text(5000),
  })).max(30),
  education: z.array(z.object({
    ...item, institution: text(160).min(1, "Institution is required"), degree: text(120), fieldOfStudy: text(120),
    startDate: month, endDate: month, grade: text(40), description: text(2000),
  })).max(15),
  projects: z.array(z.object({
    ...item, name: text(120).min(1, "Project name is required"), description: text(3000), url, technologies: z.array(text(60)).max(30),
  })).max(30),
  skills: z.array(z.object({ ...item, skill: text(60).min(1), category: text(60) })).max(150),
  certifications: z.array(z.object({
    ...item, name: text(200).min(1, "Certification name is required"), issuingOrganization: text(160), issueDate: month, credentialUrl: url,
  })).max(30),
  awards: z.array(z.object({ ...item, name: text(200).min(1, "Award name is required"), issuer: text(160), date: month, description: text(1000) })).max(30),
});

export type Profile = z.infer<typeof profileSchema>;
export type ListKey = "education" | "experience" | "projects" | "certifications" | "awards";

export const emptyProfile: Profile = {
  summary: "",
  contact: { phone: "", location: "", linkedin: "", github: "", portfolio: "" },
  education: [], experience: [], projects: [], skills: [], certifications: [], awards: [],
};

export const fmtMonth = (ym: string) =>
  !ym ? "Present" : ym.length === 4 ? ym : new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/** How a URL is printed on the resume: "https://www.example.com/x/" → "example.com/x". */
export const displayUrl = (url: string) => url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

/**
 * Where clicking a stored URL should go. Only ever http(s): anything else (including a typed
 * "javascript:…") is treated as a bare host and prefixed, so it can't run. Also restores the scheme on
 * resumes generated before links were stored whole.
 */
export const toHref = (url: string) => {
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`;
};

export type ContactItem = { text: string; href?: string };

/** The resume's contact line, each item with the link it should open. Shared by the PDF and the preview. */
export function contactItems(h: { location: string; phone: string; email: string; links: string[] }): ContactItem[] {
  const tel = h.phone.replace(/[^\d+]/g, "");
  return [
    ...(h.location ? [{ text: h.location }] : []),
    ...(h.phone ? [{ text: h.phone, ...(tel && { href: `tel:${tel}` }) }] : []),
    ...(h.email ? [{ text: h.email, href: `mailto:${h.email.trim()}` }] : []),
    ...h.links.filter((l) => l.trim()).map((l) => ({ text: displayUrl(l), href: toHref(l) })),
  ];
}
