"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { Settings2, Power, PowerOff, ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";

export default function InstalledPluginsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, Record<string, string>>>({});

  const { data: installed, refetch } = trpc.plugins.listInstalled.useQuery();
  const setStatus = trpc.plugins.setStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Plugin ${vars.status === "active" ? "enabled" : "disabled"}`);
      refetch();
    },
  });
  const saveConfig = trpc.plugins.saveConfig.useMutation({
    onSuccess: () => { toast.success("Config saved"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  function handleConfigChange(pluginId: string, key: string, value: string) {
    setConfigValues((prev) => ({
      ...prev,
      [pluginId]: { ...(prev[pluginId] ?? {}), [key]: value },
    }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Installed Plugins</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage and configure your installed plugins.</p>
      </div>

      {!installed || installed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border rounded-xl">
          <Settings2 className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-medium">No plugins installed</p>
          <p className="text-sm text-muted-foreground mt-1">
            Browse the <a href="/marketplace" className="text-primary hover:underline">marketplace</a> to find plugins.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {installed.map((ip) => {
            const isExpanded = expandedId === ip.installed.id;
            const manifest = ip.plugin?.manifest as Record<string, unknown> | null;
            const configSchema = (manifest?.configSchema as { key: string; label: string; type: string; secret?: boolean; required?: boolean }[]) ?? [];
            const currentConfig = configValues[ip.installed.id] ?? {};
            const isEnabled = ip.installed.status === "active";

            return (
              <div key={ip.installed.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Settings2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{ip.plugin?.name ?? ip.installed.pluginId}</p>
                      <Badge variant={isEnabled ? "success" : "secondary"} className="text-xs">
                        {isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      v{ip.plugin?.version ?? "—"}
                      {ip.plugin?.author ? ` · by ${ip.plugin.author}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {configSchema.length > 0 && (
                      <button
                        onClick={() => {
                          setExpandedId(isExpanded ? null : ip.installed.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        title="Configure"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setStatus.mutate({ installedPluginId: ip.installed.id, status: isEnabled ? "disabled" : "active" })}
                      className={`p-1.5 rounded-lg transition-colors ${isEnabled ? "text-emerald-500 hover:bg-emerald-50" : "text-muted-foreground hover:bg-muted"}`}
                      title={isEnabled ? "Disable" : "Enable"}
                    >
                      {isEnabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Config panel */}
                {isExpanded && configSchema.length > 0 && (
                  <div className="border-t px-4 pb-4 pt-3 bg-muted/30 space-y-3">
                    <p className="text-sm font-medium">Configuration</p>
                    {configSchema.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium mb-1.5">
                          {field.label}
                          {field.required && <span className="text-destructive ml-0.5">*</span>}
                        </label>
                        <input
                          type={field.secret ? "password" : field.type === "number" ? "number" : "text"}
                          placeholder={field.secret ? "••••••••" : `Enter ${field.label.toLowerCase()}`}
                          value={currentConfig[field.key] ?? ""}
                          onChange={(e) => handleConfigChange(ip.installed.id, field.key, e.target.value)}
                          className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {field.secret && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Stored encrypted. Leave blank to keep existing value.
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button
                        onClick={() =>
                          saveConfig.mutate({
                            installedPluginId: ip.installed.id,
                            entries: configSchema.map((f) => ({
                              key: f.key,
                              value: currentConfig[f.key] ?? "",
                              isSecret: f.secret ?? false,
                            })).filter((c) => c.value),
                          })
                        }
                        disabled={saveConfig.isPending}
                        className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {saveConfig.isPending ? "Saving…" : "Save config"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
