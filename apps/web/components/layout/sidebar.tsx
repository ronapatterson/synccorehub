"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Target, GitBranch, FolderKanban,
  HardHat, Package, Puzzle, Settings, Share2, Tag, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Leads", href: "/leads", icon: GitBranch },
  { label: "ICP Builder", href: "/icp", icon: Target },
  { label: "Segments", href: "/segments", icon: Tag },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Contractors", href: "/contractors", icon: HardHat },
  { label: "Products", href: "/products", icon: Package },
  { label: "Referrals", href: "/referrals", icon: Share2 },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Marketplace", href: "/marketplace", icon: Puzzle },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">SC</span>
        </div>
        <span className="text-sidebar-foreground font-semibold">SyncCoreHub</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/60 transition-colors">
          <div className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-medium">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-medium truncate">My Account</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
