import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarUser } from "@/components/sidebar-user";

// Auth is enforced in the DAL (every query calls verifySession); the user menu streams in behind Suspense.
// The sidebar reads the URL (active link), which dynamic routes only allow inside Suspense.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Suspense fallback={<div className="h-[57px] shrink-0 border-b border-ln-hairline bg-ln-canvas md:h-dvh md:w-[240px] md:border-r md:border-b-0" />}>
        <AppSidebar userMenu={<Suspense fallback={<span className="h-8 flex-1 animate-pulse rounded bg-ln-surface-3" />}><SidebarUser /></Suspense>} />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
