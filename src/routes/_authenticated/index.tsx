import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, StatCard, StatusPill } from "@/components/ui-bits";
import { useVehicles, useDrivers, useTrips, useFuelLogs, useMaintenance as useMaintenanceLogs } from "@/lib/data-hooks";
import { useAuth } from "@/lib/auth-context";
import {
  AlertTriangle, Truck, Activity, Users, DollarSign,
  Fuel, Wrench, Shield, CheckCircle2, ClipboardList,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Bar, BarChart, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Overview — TransitOps" }] }),
  component: Overview,
});

// ─── shared helpers ───────────────────────────────────────────────────────────
const inr  = (n: number) => "₹" + (n / 1000).toFixed(1) + "k";
const inrL = (n: number) => "₹" + (n / 100000).toFixed(2) + "L";

function sevenDays(trips: any[], fuel: any[]) {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const rev  = trips.filter(t => (t.completed_at ?? "").startsWith(key)).reduce((s, t) => s + (t.revenue ?? 0), 0);
    const cost = fuel.filter(f => f.date === key).reduce((s, f) => s + f.cost, 0);
    return { day: d.toLocaleDateString("en-GB", { weekday: "short" }), revenue: rev, cost };
  });
}

// ── Shared chart ──────────────────────────────────────────────────────────────
function RevCostChart({ days }: { days: { day: string; revenue: number; cost: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={days} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cost" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={inr} width={50} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => inr(v)} />
          <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#rev)" />
          <Area type="monotone" dataKey="cost"    stroke="var(--ink)"    strokeWidth={1.5} fill="url(#cost)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function AdminOverview() {
  const vehicles = useVehicles();
  const drivers  = useDrivers();
  const trips    = useTrips();
  const fuel     = useFuelLogs();

  const V = vehicles.data ?? [], D = drivers.data ?? [], T = trips.data ?? [], F = fuel.data ?? [];
  const days = sevenDays(T, F);
  const pendingUsers = 0; // fetched via users page; placeholder
  const anomalies = F.filter(f => f.anomaly_flag).slice(0, 3);
  const active = T.filter(t => t.status === "DISPATCHED");
  const totalRevenue = T.filter(t => t.revenue).reduce((s, t) => s + (t.revenue ?? 0), 0);

  return (
    <div className="px-6 py-8 max-w-[1600px] space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden border border-line rounded-xl bg-paper p-8 grid-lines">
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
            Admin · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h1 className="font-display text-5xl leading-[0.95] mb-3">
            System command<br /><span className="text-accent">centre.</span>
          </h1>
          <p className="text-sm text-ink-soft">Full governance view — fleet, users, finances, and compliance in one place.</p>
          <div className="flex gap-3 mt-5">
            <Link to="/users" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ink text-background text-sm font-medium hover:bg-ink/90">
              <Users className="h-4 w-4" /> Manage Users
            </Link>
            <Link to="/audit" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-line text-sm font-medium hover:bg-muted">
              <ClipboardList className="h-4 w-4" /> Audit Log
            </Link>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending approvals" value={pendingUsers} sub="awaiting admin action" accent={pendingUsers > 0} />
        <StatCard label="Active vehicles"   value={V.filter(v => v.status !== "RETIRED").length} sub={`of ${V.length} total`} />
        <StatCard label="Drivers on trip"   value={D.filter(d => d.status === "ON_TRIP").length} sub={`${D.filter(d => d.status === "AVAILABLE").length} available`} />
        <StatCard label="Active dispatches" value={active.length} sub="in transit" />
      </div>

      {/* Chart + anomalies */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last 7 days</div>
            <h3 className="font-display text-2xl">Revenue vs operating cost</h3>
          </div>
          <RevCostChart days={days} />
          <div className="mt-4 text-xs text-muted-foreground">Total revenue to date: <span className="text-ink font-medium">{inrL(totalRevenue)}</span></div>
        </Panel>
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Flags</div>
              <h3 className="font-display text-2xl">Fuel anomalies</h3>
            </div>
            <div className="h-8 w-8 rounded-full bg-accent-soft text-accent grid place-items-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-3">
            {anomalies.map(a => (
              <div key={a.id} className="p-3 border border-line rounded-md">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono">{a.vehicle_id ?? "—"}</span>
                  <span className="text-muted-foreground">{a.liters}L · ₹{a.cost.toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm text-ink-soft">{a.anomaly_reason}</div>
              </div>
            ))}
            {anomalies.length === 0 && <div className="text-sm text-muted-foreground">No anomalies.</div>}
          </div>
          <Link to="/fuel" className="block mt-4 text-xs uppercase tracking-widest text-accent">View all fuel logs →</Link>
        </Panel>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { to: "/fleet",    icon: Truck,    title: "Fleet register",    desc: `${V.filter(v => v.status === "AVAILABLE").length} available · ${V.filter(v => v.status === "IN_SHOP").length} in shop` },
          { to: "/drivers",  icon: Users,    title: "Driver roster",     desc: `${D.filter(d => d.status === "ON_TRIP").length} on trip · ${D.filter(d => d.status === "AVAILABLE").length} available` },
          { to: "/analytics",icon: Activity, title: "Analytics",         desc: "Full performance & financial breakdowns" },
        ].map(({ to, icon: Icon, title, desc }) => (
          <Panel key={to} className="p-6">
            <Icon className="h-5 w-5 text-accent mb-3" />
            <h4 className="font-display text-xl mb-1">{title}</h4>
            <p className="text-sm text-muted-foreground mb-4">{desc}</p>
            <Link to={to} className="text-xs uppercase tracking-widest text-accent">Open →</Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLEET MANAGER OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function ManagerOverview() {
  const vehicles = useVehicles();
  const drivers  = useDrivers();
  const trips    = useTrips();
  const fuel     = useFuelLogs();
  const maintenance = useMaintenanceLogs();

  const V = vehicles.data ?? [], D = drivers.data ?? [], T = trips.data ?? [], F = fuel.data ?? [], M = maintenance.data ?? [];
  const active    = T.filter(t => t.status === "DISPATCHED");
  const anomalies = F.filter(f => f.anomaly_flag).slice(0, 4);
  const openMaint = M.filter(m => m.status === "ACTIVE");
  const expiringLicenses = D.filter(d => new Date(d.license_expiry_date) < new Date(Date.now() + 90 * 24 * 3600 * 1000));

  return (
    <div className="px-6 py-8 max-w-[1600px] space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden border border-line rounded-xl bg-paper p-8 grid-lines">
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-end">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
              Fleet Ops · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 className="font-display text-5xl leading-[0.95] mb-3">
              Every asset accounted for,<br /><span className="text-accent">every kilometre earned.</span>
            </h1>
            <p className="text-sm text-ink-soft">
              {active.length} dispatches in motion · {anomalies.length} fuel anomalies · {openMaint.length} active maintenance jobs.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-line border border-line rounded-md overflow-hidden">
            {[
              { k: "Vehicles",     v: V.length,         s: `${V.filter(v => v.status === "AVAILABLE").length} available` },
              { k: "Drivers",      v: D.length,         s: `${D.filter(d => d.status === "AVAILABLE").length} available` },
              { k: "Active trips", v: active.length,    s: "in transit" },
            ].map(x => (
              <div key={x.k} className="bg-paper p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{x.k}</div>
                <div className="font-display text-2xl mt-1 tabular">{x.v}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available vehicles"  value={V.filter(v => v.status === "AVAILABLE").length} sub={`of ${V.length} fleet`} />
        <StatCard label="Drivers available"   value={D.filter(d => d.status === "AVAILABLE").length} sub={`${D.filter(d => d.status === "ON_TRIP").length} on trip`} />
        <StatCard label="Open maintenance"    value={openMaint.length} sub="active jobs" accent={openMaint.length > 0} />
        <StatCard label="Fuel anomalies"      value={anomalies.length} sub="this week" accent={anomalies.length > 0} />
      </div>

      {/* Active dispatches table */}
      <Panel className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Live</div>
          <h3 className="font-display text-2xl">Active dispatches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-line bg-muted/50">
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="text-left font-normal px-6 py-3">Route</th>
                <th className="text-left font-normal px-4 py-3">Vehicle</th>
                <th className="text-right font-normal px-4 py-3">Cargo</th>
                <th className="text-right font-normal px-4 py-3">Distance</th>
                <th className="text-left font-normal px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.map(t => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="font-medium">{t.source} → {t.destination}</div>
                    <div className="text-[11px] text-muted-foreground">{t.source_region} · {t.destination_region}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">{t.vehicle_id ?? "—"}</td>
                  <td className="px-4 py-4 text-right tabular">{((t.cargo_weight ?? 0) / 1000).toFixed(1)}t</td>
                  <td className="px-4 py-4 text-right tabular">{t.actual_distance ?? t.planned_distance} km</td>
                  <td className="px-4 py-4"><StatusPill status={t.status} /></td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">No dispatches in motion.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Anomalies + Compliance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Fuel anomaly queue</h3>
            <AlertTriangle className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            {anomalies.map(a => (
              <div key={a.id} className="p-3 border border-line rounded-md text-sm">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono">{a.vehicle_id ?? "—"}</span>
                  <span className="text-muted-foreground">{a.liters}L · ₹{a.cost.toLocaleString()}</span>
                </div>
                <div className="text-ink-soft">{a.anomaly_reason}</div>
              </div>
            ))}
            {anomalies.length === 0 && <p className="text-sm text-muted-foreground">All refuels within baseline.</p>}
          </div>
        </Panel>
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Compliance alerts</h3>
            <Shield className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            <div className="p-3 border border-line rounded-md flex justify-between items-center">
              <span className="text-sm">Licenses expiring in 90 days</span>
              <span className={`font-display text-xl ${expiringLicenses.length > 0 ? "text-accent" : "text-ink"}`}>{expiringLicenses.length}</span>
            </div>
            <div className="p-3 border border-line rounded-md flex justify-between items-center">
              <span className="text-sm">Vehicles in shop</span>
              <span className="font-display text-xl">{V.filter(v => v.status === "IN_SHOP").length}</span>
            </div>
            <div className="p-3 border border-line rounded-md flex justify-between items-center">
              <span className="text-sm">Open maintenance jobs</span>
              <span className={`font-display text-xl ${openMaint.length > 0 ? "text-accent" : "text-ink"}`}>{openMaint.length}</span>
            </div>
          </div>
          <Link to="/drivers" className="block mt-4 text-xs uppercase tracking-widest text-accent">Review roster →</Link>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL ANALYST OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function FinancialOverview() {
  const vehicles = useVehicles();
  const trips    = useTrips();
  const fuel     = useFuelLogs();
  const maintenance = useMaintenanceLogs();

  const V = vehicles.data ?? [], T = trips.data ?? [], F = fuel.data ?? [], M = maintenance.data ?? [];
  const days = sevenDays(T, F);

  const totalAssets    = V.reduce((s, v) => s + (v.acquisition_cost ?? 0), 0);
  const totalFuelCost  = F.reduce((s, f) => s + f.cost, 0);
  const totalMaintCost = M.reduce((s, m) => s + (m.cost ?? 0), 0);
  const totalRevenue   = T.filter(t => t.revenue).reduce((s, t) => s + (t.revenue ?? 0), 0);
  const netProfit      = totalRevenue - totalFuelCost - totalMaintCost;
  const margin         = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const anomaliesCost  = F.filter(f => f.anomaly_flag).reduce((s, f) => s + f.cost, 0);
  const heavyMaint     = M.filter(m => (m.cost ?? 0) > 10000).slice(0, 4);

  const typeBreakdown = ["Heavy Truck", "Medium Truck", "Light Truck"].map(type => ({
    type, cost: V.filter(v => v.type === type).reduce((s, v) => s + (v.acquisition_cost ?? 0), 0),
  }));

  return (
    <div className="px-6 py-8 max-w-[1600px] space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden border border-line rounded-xl bg-paper p-8 grid-lines">
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
            Financial · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h1 className="font-display text-5xl leading-[0.95] mb-3">
            Financial performance<br /><span className="text-accent">at a glance.</span>
          </h1>
          <p className="text-sm text-ink-soft">
            Net margin of <strong>{margin}%</strong> · {inrL(anomaliesCost)} in anomalous fuel spend · {M.length} maintenance events recorded.
          </p>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fleet capital basis"   value={inrL(totalAssets)}    sub="total acquisition cost" />
        <StatCard label="Total revenue"          value={inrL(totalRevenue)}   sub="all completed trips" />
        <StatCard label="Fuel expenditure"       value={inrL(totalFuelCost)}  sub="all fuel logs" accent />
        <StatCard label="Net profit"             value={inrL(netProfit)}      sub={`margin ${margin}%`} />
      </div>

      {/* Revenue vs Cost chart */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last 7 days</div>
            <h3 className="font-display text-2xl">Revenue vs fuel cost</h3>
          </div>
          <RevCostChart days={days} />
        </Panel>
        <Panel className="p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Asset cost</div>
            <h3 className="font-display text-2xl">By vehicle class</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBreakdown} margin={{ left: -10 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="type" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={inr} width={50} />
                <Tooltip formatter={(v: number) => inrL(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {typeBreakdown.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "var(--accent)" : i === 1 ? "var(--ink)" : "var(--muted-foreground)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* High-cost events */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Heavy maintenance spends</h3>
            <Wrench className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            {heavyMaint.map(m => (
              <div key={m.id} className="p-3 border border-line rounded-md flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{m.vehicle_id ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
                <div className="font-display text-lg text-accent">₹{(m.cost ?? 0).toLocaleString()}</div>
              </div>
            ))}
            {heavyMaint.length === 0 && <p className="text-sm text-muted-foreground">No high-cost maintenance events.</p>}
          </div>
          <Link to="/maintenance" className="block mt-4 text-xs uppercase tracking-widest text-accent">View all maintenance →</Link>
        </Panel>
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Anomalous fuel spends</h3>
            <Fuel className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            {F.filter(f => f.anomaly_flag).slice(0, 4).map(f => (
              <div key={f.id} className="p-3 border border-line rounded-md flex justify-between items-center text-sm">
                <div>
                  <div className="font-mono text-xs">{f.vehicle_id ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{f.date} · {f.liters}L</div>
                </div>
                <div className="font-display text-lg text-accent">₹{f.cost.toLocaleString()}</div>
              </div>
            ))}
            {F.filter(f => f.anomaly_flag).length === 0 && <p className="text-sm text-muted-foreground">No fuel anomalies.</p>}
          </div>
          <Link to="/fuel" className="block mt-4 text-xs uppercase tracking-widest text-accent">View all fuel logs →</Link>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function DriverOverview() {
  const trips    = useTrips();
  const fuel     = useFuelLogs();
  const vehicles = useVehicles();
  const maintenance = useMaintenanceLogs();
  const { displayName, user } = useAuth();

  const T = trips.data ?? [], F = fuel.data ?? [], V = vehicles.data ?? [], M = maintenance.data ?? [];
  const myTrips = T.filter(t => t.status === "DISPATCHED" || t.status === "DRAFT").slice(0, 5);
  const myFuel  = F.slice(-5).reverse();
  const openMaint = M.filter(m => m.status === "ACTIVE");
  const name = displayName ?? user?.email?.split("@")[0] ?? "Driver";

  return (
    <div className="px-6 py-8 max-w-[1600px] space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden border border-line rounded-xl bg-paper p-8 grid-lines">
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
            Driver Portal · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h1 className="font-display text-5xl leading-[0.95] mb-3">
            Good shift, <span className="text-accent">{name}.</span>
          </h1>
          <p className="text-sm text-ink-soft">
            {myTrips.filter(t => t.status === "DISPATCHED").length} trip(s) in progress · {openMaint.length} maintenance alert(s).
          </p>
          <div className="flex gap-3 mt-5">
            <Link to="/trips" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ink text-background text-sm font-medium hover:bg-ink/90">
              <ClipboardList className="h-4 w-4" /> My Trips
            </Link>
            <Link to="/fuel" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-line text-sm font-medium hover:bg-muted">
              <Fuel className="h-4 w-4" /> Log Fuel
            </Link>
          </div>
        </div>
      </div>

      {/* KPI mini cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Trips in progress"  value={myTrips.filter(t => t.status === "DISPATCHED").length} sub="currently dispatched" />
        <StatCard label="Pending trips"      value={myTrips.filter(t => t.status === "DRAFT").length} sub="awaiting dispatch" />
        <StatCard label="Open maintenance"   value={openMaint.length} sub="on fleet vehicles" accent={openMaint.length > 0} />
      </div>

      {/* Assigned trips */}
      <Panel className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Active</div>
          <h3 className="font-display text-2xl">Assigned dispatches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-line bg-muted/50">
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="text-left font-normal px-6 py-3">Route</th>
                <th className="text-right font-normal px-4 py-3">Cargo</th>
                <th className="text-right font-normal px-4 py-3">Distance</th>
                <th className="text-left font-normal px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {myTrips.map(t => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="font-medium">{t.source} → {t.destination}</div>
                    <div className="text-[11px] text-muted-foreground">{t.source_region} · {t.destination_region}</div>
                  </td>
                  <td className="px-4 py-4 text-right tabular">{((t.cargo_weight ?? 0) / 1000).toFixed(1)}t</td>
                  <td className="px-4 py-4 text-right tabular">{t.planned_distance} km</td>
                  <td className="px-4 py-4"><StatusPill status={t.status} /></td>
                </tr>
              ))}
              {myTrips.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-muted-foreground">No trips assigned.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Fleet health + recent fuel */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Vehicle status</h3>
            <Truck className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            {V.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                <div>
                  <div className="text-sm font-medium">{v.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{v.registration_number}</div>
                </div>
                <StatusPill status={v.status} />
              </div>
            ))}
          </div>
          <Link to="/maintenance" className="block mt-4 text-xs uppercase tracking-widest text-accent">View maintenance →</Link>
        </Panel>
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Recent refuels</h3>
            <Fuel className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            {myFuel.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-line last:border-0 text-sm">
                <div>
                  <div className="font-mono text-xs">{f.vehicle_id ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{f.date}</div>
                </div>
                <div className="text-right">
                  <div>{f.liters}L</div>
                  <div className="text-xs text-muted-foreground">₹{f.cost.toLocaleString()}</div>
                </div>
              </div>
            ))}
            {myFuel.length === 0 && <p className="text-sm text-muted-foreground">No recent fuel logs.</p>}
          </div>
          <Link to="/fuel" className="block mt-4 text-xs uppercase tracking-widest text-accent">Log fuel →</Link>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
function Overview() {
  const { isAdmin, isFleetManager, isFinancialAnalyst, isDriver } = useAuth();

  if (isAdmin)            return <AdminOverview />;
  if (isFleetManager)     return <ManagerOverview />;
  if (isFinancialAnalyst) return <FinancialOverview />;
  if (isDriver)           return <DriverOverview />;

  // Fallback (pending / unknown role)
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground text-sm">
      Your account is pending approval. Contact your admin.
    </div>
  );
}
