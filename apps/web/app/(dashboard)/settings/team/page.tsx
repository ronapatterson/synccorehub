"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { UserPlus, Mail, Crown, Shield, User, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: "secondary" | "success" | "warning" }> = {
  owner: { label: "Owner", icon: <Crown className="h-3 w-3" />, variant: "warning" },
  admin: { label: "Admin", icon: <Shield className="h-3 w-3" />, variant: "success" },
  manager: { label: "Manager", icon: <User className="h-3 w-3" />, variant: "secondary" },
  member: { label: "Member", icon: <User className="h-3 w-3" />, variant: "secondary" },
  viewer: { label: "Viewer", icon: <User className="h-3 w-3" />, variant: "secondary" },
};

export default function TeamSettingsPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // Better Auth organization hooks
  const { data: members } = trpc.tenants.listMembers.useQuery();
  const { data: invitations } = trpc.tenants.listInvitations.useQuery();

  const inviteMember = trpc.tenants.inviteMember.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
      setShowInvite(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMember = trpc.tenants.removeMember.useMutation({
    onSuccess: () => toast.success("Member removed"),
    onError: (err) => toast.error(err.message),
  });

  const cancelInvitation = trpc.tenants.cancelInvitation.useMutation({
    onSuccess: () => toast.success("Invitation cancelled"),
  });

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Team & Roles</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage team members and their permissions.</p>
      </div>

      {/* Invite */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Members</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" /> Invite member
          </button>
        </div>

        {showInvite && (
          <div className="bg-card border rounded-xl p-4 mb-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5">Email address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {["admin", "manager", "member", "viewer"].map((r) => (
                    <option key={r} value={r} className="capitalize">
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInvite(false)} className="text-sm px-3 py-1.5 border rounded-lg hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => inviteMember.mutate({ email: inviteEmail, role: inviteRole })}
                disabled={!inviteEmail || inviteMember.isPending}
                className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {inviteMember.isPending ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </div>
        )}

        <div className="bg-card border rounded-xl divide-y">
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members found.</p>
          ) : (
            members.map((member) => {
              const config = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {member.user?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{member.user?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                  </div>
                  <Badge variant={config.variant} className="text-xs gap-1">
                    {config.icon} {config.label}
                  </Badge>
                  {member.role !== "owner" && (
                    <button
                      onClick={() => {
                        if (confirm("Remove this member?")) {
                          removeMember.mutate({ memberId: member.id });
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Pending invitations */}
      {invitations && invitations.length > 0 && (
        <section>
          <h2 className="font-semibold mb-4">Pending Invitations</h2>
          <div className="bg-card border rounded-xl divide-y">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Invited as {inv.role} · expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">Pending</Badge>
                <button
                  onClick={() => cancelInvitation.mutate({ invitationId: inv.id })}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Role descriptions */}
      <section className="bg-muted/40 rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-sm">Role Permissions</h2>
        <div className="space-y-2">
          {[
            { role: "Owner", desc: "Full access — can manage billing, delete workspace, and manage all members" },
            { role: "Admin", desc: "Same as owner but cannot delete workspace or transfer ownership" },
            { role: "Manager", desc: "Can manage customers, leads, projects, and contractors" },
            { role: "Member", desc: "Can view and edit CRM data but cannot manage team or billing" },
            { role: "Viewer", desc: "Read-only access to all data" },
          ].map(({ role, desc }) => (
            <div key={role} className="flex gap-3 text-sm">
              <span className="font-medium w-16 shrink-0">{role}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
