import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";
import { useAuth, ADMIN_EMAIL } from "@/lib/auth-context";
import { SectionHeader, Panel } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import type { AppRole, AccountStatus } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "User Management — TransitOps" }] }),
  component: UserManagement,
});

type AppUser = {
  uid: string;
  email: string | null;
  display_name: string | null;
  roles: AppRole[];
  status: AccountStatus | null;
  created_at: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  driver: "Driver",
  fleet_manager: "Fleet Manager",
  financial_analyst: "Financial Analyst",
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-green-500/10 text-green-600 dark:text-green-400",
  rejected: "bg-destructive/10 text-destructive",
};

function UserManagement() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { navigate({ to: "/", replace: true }); }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    // Live-sync all user profiles from RTDB
    const profilesRef = ref(rtdb, "user_profiles");
    const unsub = onValue(profilesRef, (snap) => {
      const val = snap.val() as Record<string, Omit<AppUser, "uid">> | null;
      if (!val) { setUsers([]); setLoading(false); return; }
      const list: AppUser[] = Object.entries(val).map(([uid, d]) => ({
        uid,
        email: d.email ?? null,
        display_name: d.display_name ?? null,
        roles: Array.isArray(d.roles) ? d.roles : [],
        status: d.status ?? null,
        created_at: d.created_at ?? null,
      }));
      // Sort: pending first
      list.sort((a, b) => {
        const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
        return (order[a.status ?? "approved"] ?? 1) - (order[b.status ?? "approved"] ?? 1);
      });
      setUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin]);

  async function setStatus(uid: string, status: AccountStatus) {
    setBusy(uid + status);
    try {
      await update(ref(rtdb, `user_profiles/${uid}`), { status });
      toast.success(`User ${status === "approved" ? "approved ✓" : "rejected"}.`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(uid: string, role: AppRole) {
    setBusy(uid + "role");
    try {
      await update(ref(rtdb, `user_profiles/${uid}`), { roles: [role] });
      toast.success("Role updated.");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  const pending = users.filter(u => u.status === "pending");
  const others = users.filter(u => u.status !== "pending");

  return (
    <div className="px-6 py-8 max-w-[1200px]">
      <SectionHeader
        eyebrow="Admin"
        title="User management"
        description="Approve, reject, and manage roles for all TransitOps accounts."
      />

      {/* Pending approvals */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Pending Approval
          </span>
          {pending.length > 0 && (
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-accent text-background font-medium">
              {pending.length}
            </span>
          )}
        </div>

        {loading ? (
          <Panel className="p-8 text-center text-sm text-muted-foreground">Loading…</Panel>
        ) : pending.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-muted-foreground">
            No pending accounts. All caught up.
          </Panel>
        ) : (
          <div className="space-y-3">
            {pending.map((u) => (
              <UserRow key={u.uid} user={u} busy={busy}
                onApprove={() => setStatus(u.uid, "approved")}
                onReject={() => setStatus(u.uid, "rejected")}
                onRoleChange={(role) => changeRole(u.uid, role)}
              />
            ))}
          </div>
        )}
      </div>

      {/* All other accounts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            All Accounts
          </span>
        </div>
        {!loading && others.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-muted-foreground">No other accounts yet.</Panel>
        ) : (
          <div className="space-y-3">
            {others.map((u) => (
              <UserRow key={u.uid} user={u} busy={busy}
                onApprove={() => setStatus(u.uid, "approved")}
                onReject={() => setStatus(u.uid, "rejected")}
                onRoleChange={(role) => changeRole(u.uid, role)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, busy, onApprove, onReject, onRoleChange }: {
  user: AppUser;
  busy: string | null;
  onApprove: () => void;
  onReject: () => void;
  onRoleChange: (role: AppRole) => void;
}) {
  const isApproved = user.status === "approved";
  const isAdminAccount = user.email?.toLowerCase() === ADMIN_EMAIL;
  const roleLabel = ROLE_LABELS[user.roles[0]] ?? user.roles[0] ?? "viewer";
  const statusStyle = STATUS_STYLES[user.status ?? "approved"] ?? "";

  return (
    <Panel className="p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="h-9 w-9 rounded-full bg-accent-soft text-accent grid place-items-center text-sm font-medium shrink-0">
          {(user.display_name ?? user.email ?? "U")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{user.display_name ?? "Unnamed"}</div>
          <div className="text-xs text-muted-foreground font-mono truncate">{user.email}</div>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground shrink-0">
          {roleLabel}
        </span>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded shrink-0 ${statusStyle}`}>
          {user.status ?? "approved"}
        </span>

        {/* Role change — non-admin accounts only */}
        {!isAdminAccount && (
          <select
            className="text-xs border border-line rounded px-2 py-1 bg-background text-foreground cursor-pointer"
            value={user.roles[0] ?? "driver"}
            onChange={(e) => onRoleChange(e.target.value as AppRole)}
            disabled={!!busy}
          >
            <option value="driver">Driver</option>
            <option value="fleet_manager">Fleet Manager</option>
            <option value="financial_analyst">Financial Analyst</option>
          </select>
        )}

        {/* Approve / Reject — non-admin accounts only */}
        {!isAdminAccount && (
          <div className="flex items-center gap-2 shrink-0">
            {!isApproved && (
              <Button size="sm" variant="outline"
                className="gap-1.5 text-green-600 border-green-500/30 hover:bg-green-500/10"
                disabled={!!busy} onClick={onApprove}
              >
                <CheckCircle className="h-3.5 w-3.5" /> Approve
              </Button>
            )}
            {user.status !== "rejected" && (
              <Button size="sm" variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={!!busy} onClick={onReject}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            )}
            {user.status === "rejected" && (
              <Button size="sm" variant="outline"
                className="gap-1.5 text-green-600 border-green-500/30 hover:bg-green-500/10"
                disabled={!!busy} onClick={onApprove}
              >
                <CheckCircle className="h-3.5 w-3.5" /> Approve
              </Button>
            )}
          </div>
        )}

        {isAdminAccount && (
          <span className="text-[10px] uppercase tracking-wider text-accent">Protected</span>
        )}
      </div>
    </Panel>
  );
}
