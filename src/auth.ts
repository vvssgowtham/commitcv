import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { accounts, candidateProfiles, sessions, users } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { user: users, session: sessions, account: accounts } }),
  socialProviders: {
    // Client id/secret of a GitHub App (not an OAuth App): its user tokens are limited to the app's
    // read-only permissions on repos the user installed it on, and expire after 8h (auto-refreshed).
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  account: {
    encryptOAuthTokens: true,
    storeStateStrategy: "cookie", // no verification table needed for OAuth-only sign-in
  },
  advanced: { database: { generateId: "uuid" } },
  databaseHooks: {
    // Every user gets exactly one (empty) profile, so later code never has to handle "no profile".
    user: { create: { after: async (user) => { await db.insert(candidateProfiles).values({ userId: user.id }).onConflictDoNothing(); } } },
  },
  plugins: [nextCookies()],
});
