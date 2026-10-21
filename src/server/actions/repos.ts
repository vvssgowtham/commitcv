"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGithubToken, verifySession } from "@/lib/dal";
import { indexNextForUser } from "@/server/repo-indexer";
import { saveSyncedRepos, setRepoIncluded } from "@/server/repos";
import { fetchGrantedRepos, GithubAuthError } from "@/server/services/github";

type Result = { ok: true } | { ok: false; error: string };
type IndexResult = { ok: true; data: { remaining: number; paused: boolean; failed: string | null } } | { ok: false; error: string };

export async function syncRepos(): Promise<Result> {
  const { user } = await verifySession();
  try {
    const token = await getGithubToken();
    if (!token) return { ok: false, error: "Sign out and back in to reconnect GitHub." };
    await saveSyncedRepos(user.id, await fetchGrantedRepos(token));
    revalidatePath("/projects");
    return { ok: true };
  } catch (e) {
    if (e instanceof GithubAuthError) return { ok: false, error: "GitHub access expired. Sign out and back in to reconnect." };
    console.error("syncRepos failed", e);
    return { ok: false, error: "Couldn't reach GitHub. Please try again." };
  }
}

/** Index the next of this user's repos that needs it; the Projects page calls this until nothing is left. */
export async function indexNextRepo(): Promise<IndexResult> {
  const { user } = await verifySession();
  try {
    const token = await getGithubToken();
    if (!token) return { ok: false, error: "Sign out and back in to reconnect GitHub." };
    const r = await indexNextForUser(user.id, token);
    if (r.outcome !== "idle") revalidatePath("/projects");
    return { ok: true, data: { remaining: r.remaining, paused: r.outcome === "paused", failed: r.outcome === "failed" ? r.repo : null } };
  } catch (e) {
    if (e instanceof GithubAuthError) return { ok: false, error: "GitHub access expired. Sign out and back in to reconnect." };
    console.error("indexNextRepo failed", e);
    return { ok: false, error: "Couldn't index your repositories. Please try again." };
  }
}

export async function setIncluded(repoId: string, included: boolean): Promise<Result> {
  const { user } = await verifySession();
  const input = z.object({ repoId: z.uuid(), included: z.boolean() }).safeParse({ repoId, included });
  if (!input.success) return { ok: false, error: "Invalid request." };
  if (!(await setRepoIncluded(user.id, input.data.repoId, input.data.included))) return { ok: false, error: "Repository not found." };
  revalidatePath("/projects");
  return { ok: true };
}

