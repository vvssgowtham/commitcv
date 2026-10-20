import { z } from "zod";

// One shape shared by the intake form, base resumes and generated resumes.
const dateRange = { start: z.string().optional(), end: z.string().optional() }; // "YYYY-MM" or "Present"

export const resumeData = z.object({
  contact: z.object({
    name: z.string(),
    email: z.email(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
  }),
  summary: z.string().default(""),
  education: z
    .array(z.object({ school: z.string(), degree: z.string(), field: z.string().optional(), gpa: z.string().optional(), ...dateRange }))
    .default([]),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })).default([]),
  experience: z
    .array(z.object({ company: z.string(), role: z.string(), location: z.string().optional(), bullets: z.array(z.string()), ...dateRange }))
    .default([]),
  projects: z
    .array(z.object({ name: z.string(), url: z.url().optional(), tech: z.array(z.string()).default([]), bullets: z.array(z.string()), repoId: z.number().optional() }))
    .default([]),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string().optional(), date: z.string().optional(), url: z.url().optional() })).default([]),
  awards: z.array(z.object({ title: z.string(), issuer: z.string().optional(), date: z.string().optional(), description: z.string().optional() })).default([]),
});

export type ResumeData = z.infer<typeof resumeData>;
