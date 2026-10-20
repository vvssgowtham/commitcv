import { verifySession } from "@/lib/dal";
import { SignOutButton } from "@/components/auth-buttons";

export async function SidebarUser() {
  const { user } = await verifySession();
  const initials = user.name.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, tiny, no optimisation needed
        <img src={user.image} alt="" className="size-8 rounded-full" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-ln-surface-3 text-xs font-medium">{initials}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{user.name}</p>
        <p className="truncate text-xs text-ln-ink-subtle">{user.email}</p>
      </div>
      <SignOutButton />
    </>
  );
}
