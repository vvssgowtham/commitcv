"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderGit2, LayoutGrid, LogOut, Plus, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { user } from "@/lib/mock-data";

// App shell — design/linear.md structure (light palette): surface ladder for active rows, lavender only on the primary action.

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/projects", label: "GitHub projects", icon: FolderGit2 },
];

export function AppSidebar() {
  const path = usePathname();
  const active = (href: string) => path === href || (href === "/dashboard" && (path.startsWith("/jobs") || path.startsWith("/resumes")));

  return (
    <aside className="no-print sticky top-0 z-20 flex border-b border-ln-hairline bg-ln-canvas text-ln-ink md:h-dvh md:w-[240px] md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center px-4 py-3 md:py-4">
        <Logo href="/dashboard" />
      </div>

      <nav aria-label="App" className="flex flex-1 items-center gap-1 overflow-x-auto px-2 md:flex-col md:items-stretch md:overflow-visible">
        <Link href="/jobs/new" className="mb-0 inline-flex shrink-0 items-center gap-2 rounded-lg bg-ln-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-ln-primary-hover md:mb-3">
          <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">New application</span>
        </Link>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${active(href) ? "bg-ln-surface-3 text-ln-ink" : "text-ln-ink-subtle hover:bg-ln-surface-1 hover:text-ln-ink"}`}
          >
            <Icon className="size-4" aria-hidden /> <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-3 border-t border-ln-hairline p-4 md:flex">
        <span className="grid size-8 place-items-center rounded-full bg-ln-surface-3 text-xs font-medium">{user.name.split(" ").map((n) => n[0]).join("")}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{user.name}</p>
          <p className="truncate text-xs text-ln-ink-subtle">{user.email}</p>
        </div>
        <Link href="/" aria-label="Sign out" className="rounded-md p-1.5 text-ln-ink-subtle hover:bg-ln-surface-2 hover:text-ln-ink">
          <LogOut className="size-4" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
