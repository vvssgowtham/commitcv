"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { DAILY_GENERATIONS, generateResume, generationsToday, getGeneration } from "@/server/generate";
import { LlmError } from "@/server/services/llm";
import { downloadUrl } from "@/server/services/storage";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const input = z.object({ jobId: z.uuid(), repoIds: z.array(z.uuid()).max(10) });

export async function createResume(jobId: string, repoIds: string[]): Promise<Result<{ generationId: string }>> {
  const { user } = await verifySession();
  const parsed = input.safeParse({ jobId, repoIds });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if ((await generationsToday(user.id)) >= DAILY_GENERATIONS) return { ok: false, error: `You can generate ${DAILY_GENERATIONS} resumes per day. Try again tomorrow.` };
  try {
    const generationId = await generateResume(user.id, parsed.data.jobId, parsed.data.repoIds);
    revalidatePath("/dashboard");
    revalidatePath(`/jobs/${parsed.data.jobId}`);
    return { ok: true, data: { generationId } };
  } catch (e) {
    if (e instanceof LlmError) return { ok: false, error: e.message };
    console.error("createResume failed", e);
    return { ok: false, error: "Couldn't generate the resume. Please try again." };
  }
}

export async function resumeDownloadUrl(generationId: string): Promise<Result<{ url: string }>> {
  const { user } = await verifySession();
  const gen = await getGeneration(user.id, generationId);
  if (!gen?.pdfFileKey || gen.status !== "ready") return { ok: false, error: "This resume isn't ready." };
  const name = `${gen.doc?.header.name ?? "Resume"} - ${gen.job?.company ?? "Resume"}.pdf`;
  return { ok: true, data: { url: await downloadUrl(gen.pdfFileKey, name) } };
}
