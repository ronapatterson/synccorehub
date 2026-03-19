/**
 * Typed event hook bus.
 * Plugins subscribe to hook events; the CRM app fires them after actions.
 */

// ── Hook event definitions ─────────────────────────────────────────────────
export type HookEvent =
  // CRM
  | "crm:customer-created"
  | "crm:customer-updated"
  | "crm:customer-deleted"
  | "crm:lead-created"
  | "crm:lead-stage-changed"
  | "crm:lead-converted"  // Lead → Customer
  | "crm:lead-won"
  | "crm:lead-lost"
  // Portal
  | "portal:project-status-changed"
  | "portal:milestone-completed"
  | "portal:task-completed"
  | "portal:user-invited"
  // Referrals
  | "referral:code-used"
  | "referral:qualified"
  | "reward:earned"
  | "reward:redeemed"
  // Contractors
  | "contractor:assigned"
  | "contractor:time-entry-submitted"
  | "contractor:time-entry-approved"
  // Plugins
  | "plugin:installed"
  | "plugin:uninstalled"
  // Webhooks (internal)
  | "webhook:delivery-failed"
  // Smart Call Routing
  | "call:missed"
  | "call:scheduled";

// ── Payloads for each hook ────────────────────────────────────────────────
export type HookPayloads = {
  "crm:customer-created": { tenantId: string; customerId: string; email?: string; company?: string };
  "crm:customer-updated": { tenantId: string; customerId: string; changes: Record<string, unknown> };
  "crm:customer-deleted": { tenantId: string; customerId: string };
  "crm:lead-created": { tenantId: string; leadId: string; title: string; value?: number };
  "crm:lead-stage-changed": { tenantId: string; leadId: string; fromStageId: string; toStageId: string };
  "crm:lead-converted": { tenantId: string; leadId: string; customerId: string };
  "crm:lead-won": { tenantId: string; leadId: string; value?: number };
  "crm:lead-lost": { tenantId: string; leadId: string; reason?: string };
  "portal:project-status-changed": { tenantId: string; projectId: string; from: string; to: string; customerId?: string };
  "portal:milestone-completed": { tenantId: string; projectId: string; milestoneId: string; name: string };
  "portal:task-completed": { tenantId: string; projectId: string; taskId: string; title: string };
  "portal:user-invited": { tenantId: string; portalUserId: string; email: string };
  "referral:code-used": { tenantId: string; referralId: string; referrerId: string; referredEmail: string };
  "referral:qualified": { tenantId: string; referralId: string; referrerId: string; points: number };
  "reward:earned": { tenantId: string; portalUserId: string; points: number; reason: string };
  "reward:redeemed": { tenantId: string; portalUserId: string; points: number };
  "contractor:assigned": { tenantId: string; contractorId: string; taskId: string };
  "contractor:time-entry-submitted": { tenantId: string; contractorId: string; timeEntryId: string };
  "contractor:time-entry-approved": { tenantId: string; contractorId: string; timeEntryId: string };
  "plugin:installed": { tenantId: string; pluginSlug: string };
  "plugin:uninstalled": { tenantId: string; pluginSlug: string };
  "webhook:delivery-failed": { tenantId: string; webhookId: string; deliveryId: string; event: string };
  "call:missed": {
    tenantId: string;
    callSid: string;
    fromNumber: string;
    virtualNumberId: string;
    timestamp: string; // ISO
  };
  "call:scheduled": {
    tenantId: string;
    callSid: string;
    appointmentId: string;
    schedulingSessionId: string;
    scheduledAt: string; // ISO
    recipientUserId: string;
  };
};

// ── Hook handler type ─────────────────────────────────────────────────────
export type HookHandler<E extends HookEvent> = (
  payload: HookPayloads[E]
) => Promise<void>;

// ── Event Bus ─────────────────────────────────────────────────────────────
type Handlers = {
  [E in HookEvent]?: Array<HookHandler<E>>;
};

class EventBus {
  private handlers: Handlers = {};

  on<E extends HookEvent>(event: E, handler: HookHandler<E>): () => void {
    if (!this.handlers[event]) {
      (this.handlers as Record<string, unknown[]>)[event] = [];
    }
    (this.handlers[event] as Array<HookHandler<E>>).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers[event] as Array<HookHandler<E>>;
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  async emit<E extends HookEvent>(event: E, payload: HookPayloads[E]): Promise<void> {
    const handlers = this.handlers[event] as Array<HookHandler<E>> | undefined;
    if (!handlers?.length) return;

    // Run all handlers in parallel; log errors but don't throw
    await Promise.allSettled(
      handlers.map((handler) =>
        handler(payload).catch((err) =>
          console.error(`[EventBus] Handler error for "${event}":`, err)
        )
      )
    );
  }

  listHandlers(event: HookEvent): number {
    return this.handlers[event]?.length ?? 0;
  }
}

// Singleton event bus (process-scoped)
export const eventBus = new EventBus();
