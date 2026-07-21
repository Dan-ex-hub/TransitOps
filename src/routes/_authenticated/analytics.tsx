import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader, StatCard } from "@/components/ui-bits";
import { useVehicles, useDrivers, useTrips, useFuelLogs, useMaintenance } from "@/lib/data-hooks";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — TransitOps" }] }),
  component: Analytics,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Analytics() {
  const { isDriver } = useAuth();
  if (isDriver) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground text-sm">
        Access Denied. Drivers do not have access to Analytics.
      </div>
    );
  }

  const V = useVehicles().data ?? [];
  const D = useDrivers().data ?? [];
  const T = useTrips().data ?? [];
  const F = useFuelLogs().data ?? [];
  const M = useMaintenance().data ?? [];

  const revenue = T.reduce((s, t) => s + (t.revenue ?? 0), 0);
  const fuelCost = F.reduce((s, f) => s + f.cost, 0);
  const maintCost = M.reduce((s, m) => s + m.cost, 0);
  const margin = revenue - fuelCost - maintCost;

  const byRegion = Array.from(V.reduce((m, v) => m.set(v.region, (m.get(v.region) ?? 0) + 1), new Map<string, number>()))
    .map(([name, value]) => ({ name, value }));

  const byStatus = Array.from(V.reduce((m, v) => m.set(v.status, (m.get(v.status) ?? 0) + 1), new Map<string, number>()))
    .map(([name, value]) => ({ name, value }));

  const topDrivers = [...D].sort((a, b) => b.safety_score - a.safety_score).slice(0, 5);

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="Intelligence" title="Analytics"
        description="Revenue, cost, utilisation and driver performance."
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <StatCard label="Revenue" value={`₹${(revenue/100000).toFixed(1)}L`} sub="lifetime" />
        <StatCard label="Fuel cost" value={`₹${(fuelCost/1000).toFixed(1)}k`} />
        <StatCard label="Maintenance" value={`₹${(maintCost/1000).toFixed(1)}k`} />
        <StatCard label="Margin" value={`₹${(margin/1000).toFixed(1)}k`} accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Panel className="p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Fleet</div>
            <h3 className="font-display text-2xl">Vehicles by region</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byRegion}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Status</div>
            <h3 className="font-display text-2xl">Vehicle lifecycle</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Top performers</div>
          <h3 className="font-display text-2xl">Safety leaderboard</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-muted/50">
            <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="text-left font-normal px-6 py-3">Driver</th>
              <th className="text-left font-normal px-4 py-3">License</th>
              <th className="text-right font-normal px-4 py-3">Safety</th>
            </tr>
          </thead>
          <tbody>
            {topDrivers.map(d => (
              <tr key={d.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                <td className="px-6 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.license_category}</td>
                <td className="px-4 py-3 text-right tabular font-medium">{d.safety_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
