"use client";
import { Bell, Search } from "lucide-react";
import { signOut, useSession } from "@synccorehub/auth/client";
import { useRouter } from "next/navigation";

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {title && <h1 className="text-base font-semibold">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg transition-colors">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border bg-background text-muted-foreground font-mono">⌘K</kbd>
        </button>

        {/* Notifications */}
        <button className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-4 w-4" />
        </button>

        {/* User menu */}
        <button
          onClick={async () => { await signOut(); router.push("/auth/login"); }}
          className="flex items-center gap-2 hover:bg-muted px-2 py-1.5 rounded-lg transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center">
            <span className="text-white text-xs font-medium">
              {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <span className="text-sm font-medium hidden sm:inline">{session?.user?.name ?? "User"}</span>
        </button>
      </div>
    </header>
  );
}
