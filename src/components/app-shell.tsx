import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Truck, Users, Route as RouteIcon, Fuel, Wrench,
  BarChart3, Search, Bell, Moon, Sun, LogOut, ScrollText, User, UserCog,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALL_NAV = [
  { to: "/",            label: "Overview",    icon: LayoutDashboard, exact: true,  roles: ["admin","fleet_manager","financial_analyst","driver"] },
  { to: "/fleet",       label: "Fleet",       icon: Truck,           exact: false, roles: ["admin","fleet_manager","financial_analyst"] },
  { to: "/drivers",     label: "Drivers",     icon: Users,           exact: false, roles: ["admin","fleet_manager"] },
  { to: "/trips",       label: "Dispatch",    icon: RouteIcon,       exact: false, roles: ["admin","fleet_manager","financial_analyst","driver"] },
  { to: "/fuel",        label: "Fuel",        icon: Fuel,            exact: false, roles: ["admin","fleet_manager","financial_analyst","driver"] },
  { to: "/maintenance", label: "Maintenance", icon: Wrench,          exact: false, roles: ["admin","fleet_manager","financial_analyst","driver"] },
  { to: "/analytics",   label: "Analytics",   icon: BarChart3,       exact: false, roles: ["admin","fleet_manager","financial_analyst"] },
  { to: "/audit",       label: "Audit log",   icon: ScrollText,      exact: false, roles: ["admin"] },
  { to: "/users",       label: "Users",       icon: UserCog,         exact: false, roles: ["admin"] },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const { displayName, user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  // Filter nav items to only those the user's roles allow
  const NAV_ITEMS = ALL_NAV.filter(n =>
    roles.some(r => (n.roles as readonly string[]).includes(r))
  );
  const activeLabel = ALL_NAV.find(n => n.exact ? pathname === n.to : pathname.startsWith(n.to) && n.to !== "/")?.label ?? "Overview";
  const primaryRole = roles[0] ?? "viewer";
  const name = displayName ?? user?.email?.split("@")[0] ?? "Guest";
  const initials = name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "U";

  async function onSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-paper">
        <div className="px-6 pt-8 pb-10 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-ink text-background grid place-items-center font-display text-xl">T</div>
            <div className="leading-tight">
              <div className="font-display text-xl">TransitOps</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Logistics Command</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to) && to !== "/";
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-ink text-background" : "text-ink-soft hover:bg-muted hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" /><span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-5 border-t border-line">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Depot</div>
          <div className="text-sm">Mumbai Central</div>
          <div className="text-xs text-muted-foreground mt-0.5 tabular">IST · GMT+05:30</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-line bg-paper/70 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-1 sm:justify-between">
            <div className="min-w-0 flex items-baseline gap-3">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">Module</span>
              <h1 className="font-display text-2xl truncate">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-md border border-line bg-background w-64">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input placeholder="Search…" className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted-foreground" />
                <kbd className="text-[10px] text-muted-foreground border border-line rounded px-1 py-0.5">⌘K</kbd>
              </div>
              <button onClick={toggle} className="h-9 w-9 grid place-items-center rounded-md border border-line hover:bg-muted" aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button className="h-9 w-9 grid place-items-center rounded-md border border-line hover:bg-muted relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 pl-1 pr-3 rounded-md border border-line flex items-center gap-2 hover:bg-muted">
                    <div className="h-7 w-7 rounded-sm bg-accent-soft text-accent grid place-items-center text-xs font-medium">{initials}</div>
                    <div className="hidden sm:block leading-tight text-left">
                      <div className="text-xs">{name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{primaryRole}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm">{name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Roles</DropdownMenuLabel>
                  <div className="px-2 pb-2 flex flex-wrap gap-1">
                    {roles.length ? roles.map(r => (
                      <span key={r} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-soft text-accent">{r}</span>
                    )) : <span className="text-xs text-muted-foreground">viewer</span>}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    <User className="h-4 w-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSignOut}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>

        <footer className="border-t border-line px-6 py-4 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>TransitOps · v2.6</span>
          <span className="tabular">Sync · {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        </footer>
      </div>
    </div>
  );
}
