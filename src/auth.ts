import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/db";
import { users } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    userId: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    // shortcut: OAuth "repo" scope is read+write on all repos; switch to a GitHub App with read-only Contents before launch.
    GitHub({ authorization: { params: { scope: "read:user user:email repo" } } }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        if (!profile.email) throw new Error("GitHub account has no email");
        const [user] = await db
          .insert(users)
          .values({ email: profile.email, authProviderId: account.providerAccountId })
          .onConflictDoUpdate({ target: users.authProviderId, set: { email: profile.email, updatedAt: new Date() } })
          .returning({ id: users.id });
        token.userId = user.id;
        token.githubAccessToken = account.access_token; // JWT is encrypted; never sent to the client
      }
      return token;
    },
    session({ session, token }) {
      session.userId = token.userId as string;
      return session;
    },
  },
});
