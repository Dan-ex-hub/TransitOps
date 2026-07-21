import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader } from "@/components/ui-bits";
import { useFuelLogs, useVehicles, useUpsert, useDelete, type FuelLog } from "@/lib/data-hooks";
import { CreateButton, EditButton, DeleteButton, type FieldDef } from "@/components/crud";
import { DataToolbar } from "@/components/data-toolbar";
import { useAuth } from "@/lib/auth-context";
import { coerceRow, type ColumnDef } from "@/lib/data-tools";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fuel")({
  head: () => ({ meta: [{ title: "Fuel — TransitOps" }] }),
  component: Fuel,
});

function Fuel() {
  const { data = [], isLoading } = useFuelLogs();
  const vehicles = useVehicles().data ?? [];
  const upsert = useUpsert<FuelLog>("fuel_logs");
  const del = useDelete("fuel_logs");
  const { isManager } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const fields: FieldDef[] = [
    { name: "vehicle_id", label: "Vehicle", type: "select", required: true,
      options: vehicles.map(v => ({ label: `${v.registration_number} · ${v.name}`, value: v.id })) },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "liters", label: "Liters", type: "number", required: true },
    { name: "cost", label: "Cost (₹)", type: "number", required: true },
    { name: "anomaly_reason", label: "Anomaly note", type: "text" },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((l) => {
      if (filters.vehicle && filters.vehicle !== "all" && l.vehicle_id !== filters.vehicle) return false;
      if (filters.flag === "anomaly" && !l.anomaly_flag) return false;
      if (filters.flag === "normal" && l.anomaly_flag) return false;
      if (q) {
        const v = vehicles.find(x => x.id === l.vehicle_id);
        const hay = `${l.date} ${v?.registration_number ?? ""} ${v?.name ?? ""} ${l.anomaly_reason ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, vehicles, search, filters]);

  const totalCost = filtered.reduce((s, l) => s + l.cost, 0);
  const totalLiters = filtered.reduce((s, l) => s + l.liters, 0);
  const anomalies = filtered.filter(l => l.anomaly_flag);

  const columns: ColumnDef<FuelLog>[] = [
    { key: "date", label: "Date" },
    { key: "vehicle_id", label: "Vehicle", format: (v) => vehicles.find(x => x.id === v)?.registration_number ?? "" },
    { key: "liters", label: "Liters" },
    { key: "cost", label: "Cost" },
    { key: "anomaly_flag", label: "Anomaly", format: (v) => v ? "yes" : "no" },
    { key: "anomaly_reason", label: "Reason" },
  ];

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="Consumption" title="Fuel intelligence"
        description="Refuel logs with efficiency baselines and anomaly detection."
        actions={<CreateButton title="Log refuel" fields={fields} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v)} />}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Panel className="p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Total spend</div>
          <div className="font-display text-3xl mt-2 tabular">₹{(totalCost/1000).toFixed(1)}k</div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Volume</div>
          <div className="font-display text-3xl mt-2 tabular">{totalLiters.toFixed(0)} L</div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Anomalies</div>
          <div className="font-display text-3xl mt-2 tabular text-accent">{anomalies.length}</div>
        </Panel>
      </div>

      <DataToolbar
        search={search} onSearch={setSearch} searchPlaceholder="Search vehicle, note…"
        filters={[
          { name: "vehicle", label: "Vehicle", options: vehicles.map(v => ({ label: v.registration_number, value: v.id })) },
          { name: "flag", label: "Flag", options: [
            { label: "Anomalies", value: "anomaly" }, { label: "Normal", value: "normal" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(k, v) => setFilters(s => ({ ...s, [k]: v }))}
        rows={filtered} columns={columns} exportName="fuel_logs"
        importTable="fuel_logs" canImport={isManager}
        importRequiredColumns={["Date", "Vehicle", "Liters", "Cost"]}
        importTransform={(r) => ({
          vehicle_id:     r["Vehicle"]  ?? r["vehicle_id"]     ?? null,
          trip_id:        r["Trip"]     ?? r["trip_id"]        ?? null,
          date:           r["Date"]     ?? r["date"]           ?? "",
          liters:         Number(r["Liters"] ?? r["liters"])   || 0,
          cost:           Number(r["Cost"]   ?? r["cost"])     || 0,
          anomaly_flag:   /^(yes|true|1)$/i.test(String(r["Anomaly"] ?? r["anomaly_flag"] ?? "no")),
          anomaly_reason: (r["Reason"] ?? r["anomaly_reason"] ?? "") || null,
        })}
        onImportDone={() => qc.invalidateQueries({ queryKey: ["fuel_logs"] })}
      />

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-muted/50">
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="text-left font-normal px-6 py-3">Date</th>
                <th className="text-left font-normal px-4 py-3">Vehicle</th>
                <th className="text-right font-normal px-4 py-3">Liters</th>
                <th className="text-right font-normal px-4 py-3">Cost</th>
                <th className="text-left font-normal px-4 py-3">Flag</th>
                <th className="text-right font-normal px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</td></tr>
              ) : filtered.map(l => {
                const v = vehicles.find(x => x.id === l.vehicle_id);
                return (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 tabular text-xs">{l.date}</td>
                    <td className="px-4 py-4 font-mono text-xs">{v?.registration_number ?? "—"}</td>
                    <td className="px-4 py-4 text-right tabular">{l.liters}</td>
                    <td className="px-4 py-4 text-right tabular">₹{l.cost.toLocaleString()}</td>
                    <td className="px-4 py-4">
                      {l.anomaly_flag ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent">
                          <AlertTriangle className="h-3 w-3" /> {l.anomaly_reason ?? "flagged"}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">normal</span>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <EditButton title="Edit log" fields={fields} row={l} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v as any)} />
                        <DeleteButton disabled={!isManager} onConfirm={() => del.mutateAsync(l.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">No fuel logs match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
