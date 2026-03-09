"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Puzzle, Check, ExternalLink } from "lucide-react";
import { Badge } from "@synccorehub/ui";
import { toast } from "sonner";

const CATEGORIES = ["", "crm", "analytics", "communication", "finance", "productivity"];

export default function MarketplacePage() {
  const [category, setCategory] = useState("");
  const { data: available } = trpc.plugins.listAvailable.useQuery({ category: category || undefined });
  const { data: installed } = trpc.plugins.listInstalled.useQuery();
  const install = trpc.plugins.install.useMutation({
    onSuccess: () => toast.success("Plugin installed!"),
    onError: () => toast.error("Failed to install plugin"),
  });

  const installedIds = new Set(installed?.map((i) => i.installed.pluginId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plugin Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">Extend SyncCoreHub with integrations and plugins</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {c === "" ? "All" : c}
          </button>
        ))}
      </div>

      {/* Plugin grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {available?.map((plugin) => {
          const isInstalled = installedIds.has(plugin.id);
          return (
            <div key={plugin.id} className="bg-card border rounded-xl p-5 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {plugin.iconUrl ? (
                    <img src={plugin.iconUrl} alt={plugin.name} className="h-8 w-8 rounded" />
                  ) : (
                    <Puzzle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{plugin.name}</h3>
                    {plugin.isOfficial && <Badge variant="info" className="text-[10px]">Official</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">by {plugin.author} · v{plugin.version}</p>
                </div>
                <span className="text-sm font-semibold shrink-0">
                  {plugin.isFree ? "Free" : `$${Number(plugin.priceCents ?? 0) / 100}/mo`}
                </span>
              </div>

              <p className="text-sm text-muted-foreground flex-1 line-clamp-2 mb-4">{plugin.description}</p>

              <div className="flex items-center gap-2 mt-auto">
                {isInstalled ? (
                  <button disabled className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium py-2 rounded-lg">
                    <Check className="h-3.5 w-3.5" />
                    Installed
                  </button>
                ) : (
                  <button
                    onClick={() => install.mutate({ pluginId: plugin.id })}
                    disabled={install.isPending}
                    className="flex-1 bg-primary text-primary-foreground text-xs font-medium py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {install.isPending ? "Installing…" : "Install"}
                  </button>
                )}
                <button className="p-2 border rounded-lg hover:bg-muted transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Installed plugins section */}
      {installed && installed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Installed</h2>
          <div className="bg-card border rounded-xl divide-y">
            {installed.map(({ installed: inst, plugin }) => (
              <div key={inst.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Puzzle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{plugin.name}</p>
                    <p className="text-xs text-muted-foreground">v{plugin.version}</p>
                  </div>
                </div>
                <Badge variant={inst.status === "active" ? "success" : "secondary"} className="capitalize">{inst.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
