"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { Plus, Webhook, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";

const ALL_EVENTS = [
  "crm:customer-created",
  "crm:customer-updated",
  "crm:customer-deleted",
  "crm:lead-stage-changed",
  "crm:lead-converted",
  "portal:project-status-changed",
  "portal:milestone-completed",
  "portal:task-completed",
  "referral:qualified",
  "reward:earned",
  "plugin:installed",
];

const DELIVERY_STATUS_VARIANTS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "secondary",
  success: "success",
  failed: "destructive",
  retrying: "warning",
};

export default function WebhooksPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ url: "", events: [] as string[], description: "" });

  const { data: webhooks, refetch } = trpc.webhooks.list.useQuery();
  const { data: deliveries } = trpc.webhooks.listDeliveries.useQuery(
    { webhookId: expandedId! },
    { enabled: !!expandedId },
  );

  const createWebhook = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      toast.success("Webhook created");
      setShowCreate(false);
      setForm({ url: "", events: [], description: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteWebhook = trpc.webhooks.delete.useMutation({
    onSuccess: () => { toast.success("Webhook deleted"); refetch(); },
  });

  const retryDelivery = trpc.webhooks.retryDelivery.useMutation({
    onSuccess: () => toast.success("Retry queued"),
    onError: (err) => toast.error(err.message),
  });

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Receive real-time event notifications via HTTP POST.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Endpoints</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add endpoint
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Endpoint URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://your-app.com/webhooks/synccorehub"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Slack notification relay"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Events to subscribe</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded"
                  />
                  <span className="font-mono text-xs">{event}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-sm px-3 py-1.5 border rounded-lg hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={() =>
                createWebhook.mutate({
                  url: form.url,
                  events: form.events,
                  description: form.description || undefined,
                })
              }
              disabled={!form.url || form.events.length === 0 || createWebhook.isPending}
              className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              {createWebhook.isPending ? "Creating…" : "Create webhook"}
            </button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      <div className="space-y-3">
        {!webhooks || webhooks.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center bg-card border rounded-xl">
            <Webhook className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-medium">No webhooks configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add an endpoint to receive event notifications.
            </p>
          </div>
        ) : (
          webhooks.map((webhook) => {
            const isExpanded = expandedId === webhook.id;
            return (
              <div key={webhook.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono truncate">{webhook.url}</p>
                    {webhook.name && (
                      <p className="text-xs text-muted-foreground">{webhook.name}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(webhook.events as string[]).slice(0, 3).map((e) => (
                        <span key={e} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {e}
                        </span>
                      ))}
                      {(webhook.events as string[]).length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{(webhook.events as string[]).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={webhook.status === "active" ? "success" : "destructive"}
                      className="text-xs capitalize"
                    >
                      {webhook.status}
                    </Badge>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : webhook.id)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this webhook?")) {
                          deleteWebhook.mutate({ webhookId: webhook.id });
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/30 px-4 pb-4 pt-3">
                    <p className="text-sm font-medium mb-3">Recent Deliveries</p>
                    {!deliveries || deliveries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No deliveries yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {deliveries.map((delivery) => (
                          <div
                            key={delivery.id}
                            className="flex items-center gap-3 bg-background rounded-lg px-3 py-2.5 border"
                          >
                            <Badge
                              variant={DELIVERY_STATUS_VARIANTS[delivery.status] ?? "secondary"}
                              className="text-xs shrink-0"
                            >
                              {delivery.status}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono">{delivery.event}</p>
                              <p className="text-xs text-muted-foreground">
                                {delivery.responseStatusCode ? `HTTP ${delivery.responseStatusCode}` : "—"} ·{" "}
                                {delivery.attemptCount} attempt{delivery.attemptCount !== 1 ? "s" : ""} ·{" "}
                                {formatRelativeDate(new Date(delivery.createdAt))}
                              </p>
                            </div>
                            {delivery.status === "failed" && (
                              <button
                                onClick={() => retryDelivery.mutate({ deliveryId: delivery.id })}
                                className="text-primary hover:text-primary/80"
                                title="Retry"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
