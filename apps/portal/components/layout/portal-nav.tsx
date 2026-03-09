"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban, Package, Share2, LogOut } from "lucide-react";
import { cn } from "@synccorehub/ui";

const navItems = [
  { href: "/projects", label: "My Projects", icon: FolderKanban },
  { href: "/services", label: "Services", icon: Package },
  { href: "/referrals", label: "Referrals & Rewards", icon: Share2 },
];

export function PortalNav({ tenantName }: { tenantName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/portal-auth/logout", { method: "POST" });
    router.push("/auth/login");
  }

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-semibold text-sm">{tenantName ?? "Client Portal"}</span>
          </div>

          <nav className="hidden sm:flex gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  pathname.startsWith(href) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
