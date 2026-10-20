import { Suspense } from "react";
import { verifySession } from "@/lib/dal";
import { OnboardingFlow } from "./onboarding-flow";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-jr-mint-canvas" />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const { user } = await verifySession();
  return <OnboardingFlow userName={user.name} />;
}
