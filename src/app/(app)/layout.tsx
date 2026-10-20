import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarUser } from "@/components/sidebar-user";

// Auth is enforced in the DAL (every query calls verifySession); the user menu streams in behind Suspense.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppSidebar userMenu={<Suspense fallback={<span className="h-8 flex-1 animate-pulse rounded bg-ln-surface-3" />}><SidebarUser /></Suspense>} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
