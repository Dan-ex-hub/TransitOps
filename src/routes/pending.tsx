import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Clock, ShieldX, LogOut } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Pending Approval — TransitOps" }] }),
  component: PendingPage,
});

const ROLE_LABELS: Record<string, string> = {
  driver: "Driver",
  fleet_manager: "Fleet Manager",
  financial_analyst: "Financial Analyst",
  viewer: "Viewer",
  admin: "Admin",
  manager: "Manager",
};

function PendingPage() {
  const { user, roles, status, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) { navigate({ to: "/auth", replace: true }); return; }
      // Approved — let them into the app
      if (status === "approved" || status === null) { navigate({ to: "/", replace: true }); return; }
    }
  }, [user, status, loading, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isRejected = status === "rejected";
  const roleLabel = ROLE_LABELS[roles[0]] ?? roles[0] ?? "Unknown";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className={`mx-auto mb-6 h-20 w-20 rounded-full grid place-items-center ${
          isRejected ? "bg-destructive/10" : "bg-accent-soft"
        }`}>
          {isRejected
            ? <ShieldX className="h-9 w-9 text-destructive" />
            : <Clock className="h-9 w-9 text-accent" />
          }
        </div>

        {/* Branding */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-7 w-7 rounded-md bg-ink text-background grid place-items-center font-display text-base">T</div>
          <span className="font-display text-xl">TransitOps</span>
        </div>

        {isRejected ? (
          <>
            <h1 className="font-display text-3xl mb-2">Access Denied</h1>
            <p className="text-muted-foreground text-sm mb-2">
              Your account request was not approved.
            </p>
            <p className="text-muted-foreground text-sm mb-8">
              Please contact your fleet administrator for assistance.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl mb-2">Pending Approval</h1>
            <p className="text-muted-foreground text-sm mb-2">
              Your account has been created and is awaiting admin approval.
            </p>
            <p className="text-muted-foreground text-sm mb-8">
              Once approved, you'll be able to access TransitOps.
            </p>
          </>
        )}

        {/* Account details */}
        <div className="border border-line rounded-lg p-5 mb-6 text-left bg-paper space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono text-xs">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role requested</span>
            <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-accent-soft text-accent">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded ${
              isRejected
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}>
              {status ?? "pending"}
            </span>
          </div>
        </div>

        <Button variant="outline" onClick={handleSignOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
