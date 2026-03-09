"use client";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronRight, Building, Users, CreditCard, Key, Webhook } from "lucide-react";

const settingsSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  primaryColor: z.string().optional(),
});

type SettingsInput = z.infer<typeof settingsSchema>;

const SETTINGS_SECTIONS = [
  { href: "/settings/team", label: "Team & Roles", description: "Manage members and permissions", icon: Users },
  { href: "/settings/billing", label: "Billing & Plan", description: "Subscription, invoices, and usage", icon: CreditCard },
  { href: "/settings/plugins", label: "Installed Plugins", description: "Manage and configure plugins", icon: ChevronRight },
  { href: "/settings/api", label: "API Keys", description: "Generate and revoke API keys", icon: Key },
  { href: "/settings/webhooks", label: "Webhooks", description: "Outbound event notifications", icon: Webhook },
];

export default function SettingsPage() {
  const { data: tenant } = trpc.tenants.current.useQuery();
  const updateTenant = trpc.tenants.update.useMutation({
    onSuccess: () => toast.success("Settings saved"),
  });

  const { register, handleSubmit } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    values: { name: tenant?.name ?? "", industry: tenant?.industry ?? "" },
  });

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your workspace settings</p>
      </div>

      {/* Workspace */}
      <section>
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Building className="h-4 w-4" /> Workspace</h2>
        <form onSubmit={handleSubmit((d) => updateTenant.mutate(d))} className="bg-card border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Workspace name</label>
            <input {...register("name")} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Industry</label>
            <input {...register("industry")} placeholder="e.g. Software, Consulting, Healthcare" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Brand color</label>
            <div className="flex items-center gap-3">
              <input {...register("primaryColor")} type="color" defaultValue="#6366f1" className="h-9 w-9 rounded cursor-pointer border border-input" />
              <input {...register("primaryColor")} placeholder="#6366f1" className="flex-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <button type="submit" disabled={updateTenant.isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {updateTenant.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* Settings navigation */}
      <section className="bg-card border rounded-xl divide-y">
        {SETTINGS_SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </section>
    </div>
  );
}
