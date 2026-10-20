import { ProfileEditor } from "@/components/profile-editor";
import { profile, user } from "@/lib/mock-data";

export default function ProfilePage() {
  return <ProfileEditor initial={profile} name={user.name} email={user.email} mode="edit" />;
}
