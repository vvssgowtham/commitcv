"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

// New users land on onboarding; returning users on the dashboard.
export function SignInButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  return (
    // The label stays in layout (invisible) with the spinner overlaid, so the button never changes size
    // or wraps, whatever layout classes the caller gives it.
    <button
      className={`relative cursor-pointer disabled:cursor-wait ${className ?? ""}`}
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        // signIn.social resolves with { error } instead of throwing; on success the page navigates away.
        authClient.signIn
          .social({ provider: "github", callbackURL: "/dashboard", newUserCallbackURL: "/onboarding" })
          .then((res) => res.error && setPending(false))
          .catch(() => setPending(false));
      }}
    >
      <span className={`contents ${pending ? "invisible" : ""}`}>{children}</span>
      {pending && (
        <>
          <Loader2 className="absolute inset-0 m-auto size-4 animate-spin" aria-hidden />
          <span className="sr-only">Signing in…</span>
        </>
      )}
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      aria-label="Sign out"
      disabled={pending}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-ln-hairline px-2.5 py-1.5 text-sm text-ln-ink-subtle hover:bg-ln-surface-2 hover:text-ln-ink disabled:cursor-wait disabled:opacity-60"
      onClick={() => {
        setPending(true);
        authClient.signOut({
          // refresh() drops the client router cache so Back can't show a signed-in page.
          fetchOptions: { onSuccess: () => { router.replace("/"); router.refresh(); }, onError: () => setPending(false) },
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
      <span className="hidden md:inline">{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
