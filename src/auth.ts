import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }),
  providers: [
    // shortcut: OAuth "repo" scope is read+write on all repos; switch to a GitHub App with read-only Contents before launch.
    GitHub({ authorization: { params: { scope: "read:user user:email repo" } } }),
  ],
});
