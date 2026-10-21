import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { accounts } from "@/db/schema";

// Every data read/write goes through this; scope all queries by the returned user.id.
export const verifySession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return session;
});

// Fresh GitHub token for the current user; Better Auth refreshes it when expired.
export async function getGithubToken() {
  const { user } = await verifySession();
  return githubTokenFor(user.id);
}

/**
 * Fresh GitHub token for `userId`, with no session check — only for server-side jobs (the indexing cron)
 * and for getGithubToken above. Never call it with a user id that came from a client.
 */
export async function githubTokenFor(userId: string) {
  const account = await db.query.accounts.findFirst({
    columns: { id: true },
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "github")),
  });
  if (!account) throw new Error("No GitHub account linked");
  const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
  return accessToken;
}
