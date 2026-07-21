import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { auth, rtdb, googleProvider } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — TransitOps" }] }),
  component: AuthPage,
});

// The only admin account — cannot be created via sign-up
export const ADMIN_EMAIL = "admin@transitops.com";

const SIGNUP_ROLES: { label: string; value: AppRole; description: string }[] = [
  { label: "Driver", value: "driver", description: "Assigned trips & compliance" },
  { label: "Fleet Manager", value: "fleet_manager", description: "Full fleet & dispatch control" },
  { label: "Financial Analyst", value: "financial_analyst", description: "Revenue, cost & fuel insights" },
];

type AuthMode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("driver");
  const [loading, setLoading] = useState(false);

  // Detect if the typed email is the admin email
  const isAdminEmail = email.trim().toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => { if (u) navigate({ to: "/" }); });
    return () => unsub();
  }, [navigate]);

  async function createUserProfile(uid: string, email: string | null, displayName: string | null, assignRole?: AppRole, isAdmin = false) {
    const payload: Record<string, any> = {
      uid,
      email,
      display_name: displayName,
      created_at: new Date().toISOString(),
    };
    if (isAdmin) {
      payload.roles = ["admin"];
      payload.status = "approved";
    } else if (assignRole) {
      payload.roles = [assignRole];
      payload.status = "pending"; // awaits admin approval
    }
    await set(ref(rtdb, `user_profiles/${uid}`), payload);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // Ensure admin doc exists on first admin login
        if (isAdminEmail) {
          await createUserProfile(cred.user.uid, cred.user.email, cred.user.displayName ?? "Admin", undefined, true);
        }
        toast.success("Welcome back");
      } else {
        if (isAdminEmail) {
          toast.error("Admin account cannot be created via sign-up.");
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const dn = name.trim() || email.split("@")[0];
        await updateProfile(cred.user, { displayName: dn });
        await createUserProfile(cred.user.uid, cred.user.email, dn, role);
        toast.success("Account created — awaiting admin approval.");
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    if (isAdminEmail) {
      toast.error("Admin must sign in with email and password.");
      return;
    }
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      // For Google sign-in: only write profile if it doesn't exist yet
      const snap = await get(ref(rtdb, `user_profiles/${cred.user.uid}`));
      if (!snap.exists()) {
        await set(ref(rtdb, `user_profiles/${cred.user.uid}`), {
          uid: cred.user.uid,
          email: cred.user.email,
          display_name: cred.user.displayName,
          roles: ["driver"],
          status: "pending",
          created_at: new Date().toISOString(),
        });
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
    }
  }

  function switchMode(m: AuthMode) {
    setMode(m);
    setEmail("");
    setPassword("");
    setName("");
    setRole("driver");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-paper border-r border-line grid-lines">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-ink text-background grid place-items-center font-display text-xl">T</div>
          <div>
            <div className="font-display text-2xl">TransitOps</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Logistics Command</div>
          </div>
        </Link>
        <div>
          <h1 className="font-display text-5xl leading-tight mb-4">
            Every asset accounted for.<br />
            <span className="text-accent">Every kilometre earned.</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Fleet, dispatch, fuel and maintenance intelligence — powered by Firebase.
          </p>
          <div className="mt-8 p-4 border border-line rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium uppercase tracking-widest">Admin Demo</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Email: <span className="font-mono text-foreground">{ADMIN_EMAIL}</span></div>
              <div>Password: <span className="font-mono text-foreground">Admin@123</span></div>
            </div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">TransitOps · v3.0</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
              {mode === "signin" ? "Return to console" : "Request access"}
            </div>
            <h2 className="font-display text-3xl">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            {mode === "signup" && (
              <p className="text-sm text-muted-foreground mt-1">
                New accounts require admin approval before access is granted.
              </p>
            )}
          </div>

          {/* Google — hidden when admin email is typed */}
          {!isAdminEmail && (
            <>
              <Button variant="outline" className="w-full h-10 mb-4" onClick={onGoogle} type="button">
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-line" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          {isAdminEmail && mode === "signup" && (
            <div className="mb-4 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive">
              Admin accounts cannot be created here. Please sign in instead.
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && !isAdminEmail && (
              <>
                {/* Display name */}
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Ravi Kapadia"
                    autoComplete="name"
                  />
                </div>

                {/* Role selector — 3 cards */}
                <div>
                  <Label className="mb-2 block">Role</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {SIGNUP_ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`text-left px-4 py-3 rounded-md border transition-all ${
                          role === r.value
                            ? "border-ink bg-ink text-background"
                            : "border-line bg-background hover:bg-muted"
                        }`}
                      >
                        <div className="text-sm font-medium">{r.label}</div>
                        <div className={`text-[11px] mt-0.5 ${role === r.value ? "text-background/70" : "text-muted-foreground"}`}>
                          {r.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                placeholder={mode === "signup" ? "you@example.com" : ""}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (mode === "signup" && isAdminEmail)}
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Request access"}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              className="underline hover:text-foreground"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
