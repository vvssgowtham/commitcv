"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { analyzeAndSaveJob, DAILY_JOBS, jobsToday } from "@/server/jobs";
import { fetchPostingText, LlmError } from "@/server/services/llm";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const input = z.union([
  z.object({ url: z.url({ protocol: /^https?$/ }).max(2000) }),
  z.object({ text: z.string().trim().min(50, "Paste the full job description (at least 50 characters).").max(30_000) }),
]);

export async function createJob(raw: { url: string } | { text: string }): Promise<Result<{ jobId: string }>> {
  const { user } = await verifySession();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if ((await jobsToday(user.id)) >= DAILY_JOBS) return { ok: false, error: `You can analyse ${DAILY_JOBS} jobs per day. Try again tomorrow.` };

  try {
    const url = "url" in parsed.data ? parsed.data.url : null;
    const description = url ? await fetchPostingText(url) : (parsed.data as { text: string }).text;
    const jobId = await analyzeAndSaveJob(user.id, description, url);
    revalidatePath("/dashboard");
    return { ok: true, data: { jobId } };
  } catch (e) {
    if (e instanceof LlmError) return { ok: false, error: e.message };
    console.error("createJob failed", e);
    return { ok: false, error: "Couldn't analyse that job. Please try again." };
  }
}
