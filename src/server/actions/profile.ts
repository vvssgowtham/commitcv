"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { z } from "zod";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { verifySession } from "@/lib/dal";
import { profileSchema, type Profile } from "@/lib/profile";
import type { Change } from "@/lib/resume-merge";
import { applyImport, previewImport, writeProfile } from "@/server/profile";
import { contentTypes, extractPdfText, MAX_RESUME_BYTES, normalizeParsed, PARSE_SYSTEM, parsedResumeOutput, sniffResume } from "@/server/resume-file";
import { LlmError, structured } from "@/server/services/llm";
import { putObject } from "@/server/services/storage";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DAILY_UPLOADS = 10;

export async function saveProfile(input: Profile): Promise<Result<Profile>> {
  const { user } = await verifySession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  const profile = await writeProfile(user.id, parsed.data, "user");
  revalidatePath("/profile");
  return { ok: true, data: profile };
}

/** Upload + parse a resume, then return what would change. Nothing touches the profile until `applyResume`. */
export async function uploadResume(form: FormData): Promise<Result<{ resumeId: string; changes: Change[] }>> {
  const { user } = await verifySession();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF or DOCX file." };
  if (file.size > MAX_RESUME_BYTES) return { ok: false, error: "That file is over 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffResume(bytes);
  if (!kind) return { ok: false, error: "Only PDF and DOCX resumes are supported." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ n }] = await db.select({ n: count() }).from(resumes).where(and(eq(resumes.userId, user.id), gte(resumes.createdAt, since)));
  if (n >= DAILY_UPLOADS) return { ok: false, error: `You can upload ${DAILY_UPLOADS} resumes per day. Try again tomorrow.` };

  try {
    const text = kind === "pdf" ? await extractPdfText(bytes) : (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    if (text.trim().length < 50) return { ok: false, error: "Couldn't find readable text in that file — if it's a scanned image, try a text-based PDF instead." };
    const parsed = normalizeParsed(await structured(parsedResumeOutput, { system: PARSE_SYSTEM, prompt: `<resume>\n${text}\n</resume>\nExtract this resume.` }));

    // Parse first, store second: a failed parse leaves no orphaned file.
    const fileKey = `users/${user.id}/resumes/${crypto.randomUUID()}.${kind}`;
    await putObject(fileKey, bytes, contentTypes[kind]);
    const [row] = await db.insert(resumes).values({ userId: user.id, fileKey, parsedContent: parsed }).returning({ id: resumes.id });
    return { ok: true, data: { resumeId: row.id, changes: await previewImport(user.id, row.id) } };
  } catch (e) {
    if (e instanceof LlmError) return { ok: false, error: e.message };
    console.error("uploadResume failed", e);
    return { ok: false, error: "Couldn't read that resume. Please try again." };
  }
}

const applyInput = z.object({ resumeId: z.uuid(), changeIds: z.union([z.literal("all"), z.array(z.string().max(300)).max(500)]) });

export async function applyResume(resumeId: string, changeIds: string[] | "all"): Promise<Result<Profile>> {
  const { user } = await verifySession();
  const input = applyInput.safeParse({ resumeId, changeIds });
  if (!input.success) return { ok: false, error: "Invalid request." };
  try {
    const profile = await applyImport(user.id, input.data.resumeId, input.data.changeIds);
    revalidatePath("/profile");
    return { ok: true, data: profile };
  } catch (e) {
    console.error("applyResume failed", e);
    return { ok: false, error: "Couldn't apply those changes. Please try again." };
  }
}
