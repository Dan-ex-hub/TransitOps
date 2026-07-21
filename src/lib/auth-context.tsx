import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  type User,
} from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { auth, rtdb } from "@/integrations/firebase/client";

export type AppRole = "admin" | "manager" | "fleet_manager" | "driver" | "financial_analyst" | "viewer";
export type AccountStatus = "pending" | "approved" | "rejected";

// The one hardcoded admin — always has admin role regardless of RTDB doc
export const ADMIN_EMAIL = "admin@transitops.com";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  profileLoaded: boolean;
  roles: AppRole[];
  status: AccountStatus | null;
  isManager: boolean;        // admin or fleet_manager (write access)
  isAdmin: boolean;
  isFleetManager: boolean;
  isFinancialAnalyst: boolean;
  isDriver: boolean;
  isPending: boolean;
  isRejected: boolean;
  displayName: string | null;
  refreshProfile: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, profileLoaded: false,
  roles: [], status: null,
  isManager: false, isAdmin: false, isFleetManager: false,
  isFinancialAnalyst: false, isDriver: false,
  isPending: false, isRejected: false,
  displayName: null,
  refreshProfile: () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setRoles([]);
        setStatus(null);
        setProfileLoaded(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    // ── Admin shortcut: detect by email, bypass RTDB lookup ──
    if (user.email?.toLowerCase() === ADMIN_EMAIL) {
      setRoles(["admin"]);
      setStatus("approved");
      setDisplayName(user.displayName ?? "Admin");
      setProfileLoaded(true);
      // Ensure admin profile exists in RTDB
      set(ref(rtdb, `user_profiles/${user.uid}`), {
        email: user.email,
        display_name: user.displayName ?? "Admin",
        roles: ["admin"],
        status: "approved",
        uid: user.uid,
      }).catch(() => {});
      return;
    }

    // ── Regular users: live-sync from RTDB user_profiles/{uid} ──
    const profileRef = ref(rtdb, `user_profiles/${user.uid}`);
    const unsub = onValue(profileRef, (snap) => {
      const d = snap.val() as {
        display_name?: string;
        roles?: AppRole[];
        status?: AccountStatus;
      } | null;

      setDisplayName(d?.display_name ?? user.displayName ?? null);
      setRoles(Array.isArray(d?.roles) ? d!.roles! : []);
      // If no doc yet (brand new user before profile write completes), stay null
      setStatus(d?.status ?? null);
      setProfileLoaded(true);
    });
    return () => unsub();
  }, [user?.uid]);

  const isAdmin          = roles.includes("admin");
  const isFleetManager   = roles.includes("fleet_manager") || roles.includes("manager");
  const isFinancialAnalyst = roles.includes("financial_analyst");
  const isDriver         = roles.includes("driver");

  const value: AuthCtx = {
    user,
    loading,
    profileLoaded,
    roles,
    status,
    isManager: isAdmin || isFleetManager,
    isAdmin,
    isFleetManager,
    isFinancialAnalyst,
    isDriver,
    isPending: status === "pending",
    isRejected: status === "rejected",
    displayName,
    refreshProfile: () => {},
    signOut: async () => { await fbSignOut(auth); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// Utility for profile pages
export async function updateDisplayName(user: User, name: string) {
  await fbUpdateProfile(user, { displayName: name });
  await set(ref(rtdb, `user_profiles/${user.uid}/display_name`), name);
}
