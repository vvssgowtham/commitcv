import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ProfileEditor } from "@/components/profile-editor";
import { verifySession } from "@/lib/dal";
import { getProfile } from "@/server/profile";

export default function ManualOnboarding() {
  return (
    <>
      <header className="border-b border-no-hairline bg-white px-4 py-3"><Logo /></header>
      <Suspense fallback={<div className="min-h-dvh bg-no-canvas" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const { user } = await verifySession();
  return <ProfileEditor initial={await getProfile(user.id)} name={user.name} email={user.email} mode="onboarding" />;
}
