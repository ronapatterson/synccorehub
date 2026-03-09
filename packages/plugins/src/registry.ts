import type { HookEvent, HookHandler } from "./hooks";
import { eventBus } from "./hooks";
import type { PluginManifest } from "./manifest";
import { validateManifest } from "./manifest";

// ── Registered Plugin Entry ────────────────────────────────────────────────
type RegisteredPlugin = {
  manifest: PluginManifest;
  handlers: Partial<{
    [E in HookEvent]: HookHandler<E>;
  }>;
  unsubscribers: Array<() => void>;
};

// ── Plugin Registry ────────────────────────────────────────────────────────
class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();

  /**
   * Register a plugin with its manifest and hook handlers.
   * Validates the manifest and subscribes to the event bus.
   */
  register(
    manifest: unknown,
    handlers: Partial<{ [E in HookEvent]: HookHandler<E> }>
  ): string {
    const validManifest = validateManifest(manifest);

    if (this.plugins.has(validManifest.id)) {
      throw new Error(`Plugin "${validManifest.id}" is already registered`);
    }

    const unsubscribers: Array<() => void> = [];

    // Subscribe handlers to the event bus for hooks declared in the manifest
    for (const hookEvent of validManifest.hooks) {
      const event = hookEvent as HookEvent;
      const handler = handlers[event];
      if (handler) {
        const unsub = eventBus.on(event, handler as HookHandler<typeof event>);
        unsubscribers.push(unsub);
      }
    }

    this.plugins.set(validManifest.id, {
      manifest: validManifest,
      handlers,
      unsubscribers,
    });

    return validManifest.id;
  }

  /**
   * Unregister a plugin and remove its event bus subscriptions.
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    for (const unsub of plugin.unsubscribers) {
      unsub();
    }

    this.plugins.delete(pluginId);
  }

  get(pluginId: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
}

export const pluginRegistry = new PluginRegistry();
