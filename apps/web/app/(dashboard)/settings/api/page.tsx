"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { Plus, Key, Trash2, Eye, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";

export default function ApiKeysPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: [] as string[] });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data: keys, refetch } = trpc.apiKeys.list.useQuery();
  const { data: availableScopes } = trpc.apiKeys.availableScopes.useQuery();

  const createKey = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setNewKey(data.fullKey);
      setShowCreate(false);
      setForm({ name: "", scopes: [] });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeKey = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => { toast.success("API key revoked"); refetch(); },
  });

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleScope(scope: string) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate API keys to authenticate external integrations.
        </p>
      </div>

      {/* New key banner */}
      {newKey && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 dark:bg-emerald-950/20 dark:border-emerald-800">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
            API key created — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-white dark:bg-black/20 border rounded-lg px-3 py-2 truncate">
              {showKey ? newKey : "sk_live_" + "•".repeat(32)}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={() => copyKey(newKey)}
              className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-emerald-600 hover:underline mt-2"
          >
            I&apos;ve copied it, dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Your keys</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Generate key
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Key name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Zapier integration"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {availableScopes && (
            <div>
              <label className="block text-sm font-medium mb-2">Scopes</label>
              <div className="flex flex-wrap gap-2">
                {availableScopes.map((scope) => (
                  <label key={scope} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded"
                    />
                    <span className="text-sm font-mono">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-sm px-3 py-1.5 border rounded-lg hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={() => createKey.mutate({ name: form.name, scopes: form.scopes })}
              disabled={!form.name || createKey.isPending}
              className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              {createKey.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="bg-card border rounded-xl divide-y">
        {!keys || keys.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Key className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center gap-4 px-5 py-3.5">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{key.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {key.keyPrefix}••••••••••••••••
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(key.scopes as string[]).map((s) => (
                    <span key={s} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-right shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Created {formatRelativeDate(new Date(key.createdAt))}
                  </p>
                  {key.lastUsedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last used {formatRelativeDate(new Date(key.lastUsedAt))}
                    </p>
                  )}
                </div>
                <Badge variant={key.revokedAt ? "destructive" : "success"} className="text-xs">
                  {key.revokedAt ? "Revoked" : "Active"}
                </Badge>
                {!key.revokedAt && (
                  <button
                    onClick={() => {
                      if (confirm("Revoke this API key? This cannot be undone.")) {
                        revokeKey.mutate({ keyId: key.id });
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
