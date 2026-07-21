import { createFileRoute } from "@tanstack/react-router";
import { Panel, StatCard, StatusPill } from "@/components/ui-bits";
import { useVehicles, useDrivers, useTrips, useFuelLogs } from "@/lib/data-hooks";
import { AlertTriangle, Truck, Activity } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Overview — TransitOps" }] }),
  component: Overview,
});

function Overview() {
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const trips = useTrips();
  const fuel = useFuelLogs();

  const V = vehicles.data ?? [], D = drivers.data ?? [], T = trips.data ?? [], F = fuel.data ?? [];
  const active = T.filter(t => t.status === "DISPATCHED");
  const anomalies = F.filter(f => f.anomaly_flag).slice(0, 4);
  const inr = (n: number) => "₹" + (n / 1000).toFixed(1) + "k";
  const vehById = (id: string | null) => V.find(v => v.id === id);
  const drvById = (id: string | null) => D.find(d => d.id === id);

  // 7 day series from trips/fuel
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const rev = T.filter(t => (t.completed_at ?? "").startsWith(key)).reduce((s, t) => s + (t.revenue ?? 0), 0);
    const cost = F.filter(f => f.date === key).reduce((s, f) => s + f.cost, 0);
    return { day: d.toLocaleDateString("en-GB", { weekday: "short" }), revenue: rev, cost };
  });

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <div className="relative overflow-hidden border border-line rounded-xl bg-paper p-8 mb-8 grid-lines">
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-end">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-3">Depot report · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
            <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mb-4">
              Every asset accounted for,<br />
              <span className="text-accent">every kilometre earned.</span>
            </h1>
            <p className="text-sm text-ink-soft max-w-lg">
              {active.length} dispatches in motion. {anomalies.length} fuel anomalies flagged for review.
              Fleet utilisation at {V.length ? Math.round(V.filter(v => v.status === "ON_TRIP").length / V.length * 100) : 0}%.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-line border border-line rounded-md overflow-hidden">
            {[
              { k: "Vehicles", v: V.length, s: `${V.filter(v => v.status === "AVAILABLE").length} available` },
              { k: "Drivers", v: D.length, s: `${D.filter(d => d.status === "AVAILABLE").length} available` },
              { k: "Active trips", v: active.length, s: "in transit" },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Active vehicles" value={V.filter(v => v.status !== "RETIRED").length} sub={`of ${V.length} total`} />
        <StatCard label="Drivers on trip" value={D.filter(d => d.status === "ON_TRIP").length} sub={`${D.filter(d => d.status === "AVAILABLE").length} available`} />
        <StatCard label="Trips today" value={T.filter(t => (t.dispatched_at ?? "").startsWith(new Date().toISOString().slice(0, 10))).length} sub="dispatched" />
        <StatCard label="Anomalies" value={F.filter(f => f.anomaly_flag).length} sub="review recommended" accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] mb-8">
        <Panel className="p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last 7 days</div>
            <h3 className="font-display text-2xl">Revenue vs operating cost</h3>
          </div>
          <div className="h-72">
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
                <Area type="monotone" dataKey="cost" stroke="var(--ink)" strokeWidth={1.5} fill="url(#cost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Alerts</div>
              <h3 className="font-display text-2xl">Anomaly queue</h3>
            </div>
            <div className="h-8 w-8 rounded-full bg-accent-soft text-accent grid place-items-center"><AlertTriangle className="h-4 w-4" /></div>
          </div>
          <div className="space-y-3">
            {anomalies.map(a => {
              const v = vehById(a.vehicle_id);
              return (
                <div key={a.id} className="p-3 border border-line rounded-md">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono">{v?.registration_number ?? "—"}</span>
                    <span className="tabular text-muted-foreground">{a.liters}L · ₹{a.cost.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">{a.anomaly_reason}</div>
                </div>
              );
            })}
            {anomalies.length === 0 && <div className="text-sm text-muted-foreground">No anomalies. All refuels within baseline.</div>}
          </div>
        </Panel>
      </div>

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
                <th className="text-left font-normal px-4 py-3">Driver</th>
                <th className="text-right font-normal px-4 py-3">Cargo</th>
                <th className="text-right font-normal px-4 py-3">Distance</th>
                <th className="text-left font-normal px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.map(t => {
                const v = vehById(t.vehicle_id); const d = drvById(t.driver_id);
                return (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-medium">{t.source} → {t.destination}</div>
                      <div className="text-[11px] text-muted-foreground">{t.source_region} · {t.destination_region}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{v?.registration_number ?? "—"}</td>
                    <td className="px-4 py-4">{d?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-right tabular">{(t.cargo_weight / 1000).toFixed(1)}t</td>
                    <td className="px-4 py-4 text-right tabular">{t.actual_distance ?? t.planned_distance} km</td>
                    <td className="px-4 py-4"><StatusPill status={t.status} /></td>
                  </tr>
                );
              })}
              {active.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">No dispatches in motion.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3 mt-8">
        <Panel className="p-6">
          <Truck className="h-5 w-5 text-accent mb-3" />
          <h4 className="font-display text-xl mb-1">Fleet health</h4>
          <p className="text-sm text-muted-foreground mb-4">{V.filter(v => v.status === "AVAILABLE").length} available · {V.filter(v => v.status === "IN_SHOP").length} in shop.</p>
          <Link to="/fleet" className="text-xs uppercase tracking-widest text-accent">Open fleet →</Link>
        </Panel>
        <Panel className="p-6">
          <Activity className="h-5 w-5 text-accent mb-3" />
          <h4 className="font-display text-xl mb-1">Driver rota</h4>
          <p className="text-sm text-muted-foreground mb-4">{D.filter(d => d.status === "ON_TRIP").length} on trip · {D.filter(d => d.status === "AVAILABLE").length} available.</p>
          <Link to="/drivers" className="text-xs uppercase tracking-widest text-accent">Open roster →</Link>
        </Panel>
        <Panel className="p-6">
          <AlertTriangle className="h-5 w-5 text-accent mb-3" />
          <h4 className="font-display text-xl mb-1">Compliance</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {D.filter(d => new Date(d.license_expiry_date) < new Date(Date.now() + 90 * 24 * 3600 * 1000)).length} licenses expiring within 90 days.
          </p>
          <Link to="/drivers" className="text-xs uppercase tracking-widest text-accent">Review →</Link>
        </Panel>
      </div>
    </div>
  );
}
