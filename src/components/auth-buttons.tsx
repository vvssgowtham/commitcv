"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

// New users land on onboarding; returning users on the dashboard.
export function SignInButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      className={className}
      disabled={pending}
      onClick={() => {
        setPending(true);
        authClient.signIn.social({ provider: "github", callbackURL: "/dashboard", newUserCallbackURL: "/onboarding" }).catch(() => setPending(false));
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      aria-label="Sign out"
      className="rounded-md p-1.5 text-ln-ink-subtle hover:bg-ln-surface-2 hover:text-ln-ink"
      onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}
    >
      <LogOut className="size-4" aria-hidden />
    </button>
  );
}
