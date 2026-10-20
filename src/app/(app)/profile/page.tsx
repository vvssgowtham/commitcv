import { ProfileEditor } from "@/components/profile-editor";
import { verifySession } from "@/lib/dal";
import { getProfile } from "@/server/profile";

export default async function ProfilePage() {
  const { user } = await verifySession();
  return <ProfileEditor initial={await getProfile(user.id)} name={user.name} email={user.email} mode="edit" />;
}
