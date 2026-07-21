import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { user, loading, profileLoaded, isPending, isRejected } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    // Only redirect after we've confirmed their status from RTDB
    if (profileLoaded && (isPending || isRejected)) {
      navigate({ to: "/pending" }); return;
    }
  }, [loading, user, profileLoaded, isPending, isRejected, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Verifying session…</div>
      </div>
    );
  }

  // Show a brief loading state while RTDB profile loads (only the first render)
  if (!profileLoaded) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
