import { Logo } from "@/components/logo";
import { ProfileEditor } from "@/components/profile-editor";
import { user } from "@/lib/mock-data";

const empty = {
  summary: "",
  contact: { phone: "", location: "", linkedin: "", github: "" },
  education: [], experience: [], projects: [], skills: [], certifications: [], awards: [],
};

export default function ManualOnboarding() {
  return (
    <>
      <header className="border-b border-no-hairline bg-white px-4 py-3"><Logo /></header>
      <ProfileEditor initial={empty} name={user.name} email={user.email} mode="onboarding" />
    </>
  );
}
