import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader, StatusPill } from "@/components/ui-bits";
import { useMaintenance, useVehicles, useUpsert, useDelete, type MaintenanceLog } from "@/lib/data-hooks";
import { CreateButton, EditButton, DeleteButton, type FieldDef } from "@/components/crud";
import { DataToolbar } from "@/components/data-toolbar";
import { useAuth } from "@/lib/auth-context";
import { coerceRow, type ColumnDef } from "@/lib/data-tools";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — TransitOps" }] }),
  component: Maintenance,
});

function Maintenance() {
  const { data = [], isLoading } = useMaintenance();
  const vehicles = useVehicles().data ?? [];
  const upsert = useUpsert<MaintenanceLog>("maintenance_logs");
  const del = useDelete("maintenance_logs");
  const { isManager } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const fields: FieldDef[] = [
    { name: "vehicle_id", label: "Vehicle", type: "select", required: true,
      options: vehicles.map(v => ({ label: `${v.registration_number} · ${v.name}`, value: v.id })) },
    { name: "description", label: "Description", type: "text", required: true },
    { name: "cost", label: "Cost (₹)", type: "number" },
    { name: "start_date", label: "Start date", type: "date", required: true },
    { name: "end_date", label: "End date", type: "date" },
    { name: "status", label: "Status", type: "select", required: true, options: [
      { label: "Active", value: "ACTIVE" }, { label: "Closed", value: "CLOSED" },
    ] },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((m) => {
      if (filters.status && filters.status !== "all" && m.status !== filters.status) return false;
      if (filters.vehicle && filters.vehicle !== "all" && m.vehicle_id !== filters.vehicle) return false;
      if (q) {
        const v = vehicles.find(x => x.id === m.vehicle_id);
        const hay = `${m.description} ${v?.registration_number ?? ""} ${v?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, vehicles, search, filters]);

  const columns: ColumnDef<MaintenanceLog>[] = [
    { key: "vehicle_id", label: "Vehicle", format: (v) => vehicles.find(x => x.id === v)?.registration_number ?? "" },
    { key: "description", label: "Description" },
    { key: "start_date", label: "Start" },
    { key: "end_date", label: "End" },
    { key: "cost", label: "Cost" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="Service" title="Maintenance ledger"
        description="Every workshop event, cost recorded, downtime accounted."
        actions={<CreateButton title="Open work order" fields={fields} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v)} />}
      />

      <DataToolbar
        search={search} onSearch={setSearch} searchPlaceholder="Search description, vehicle…"
        filters={[
          { name: "status", label: "Status", options: [
            { label: "Active", value: "ACTIVE" }, { label: "Closed", value: "CLOSED" },
          ]},
          { name: "vehicle", label: "Vehicle", options: vehicles.map(v => ({ label: v.registration_number, value: v.id })) },
        ]}
        filterValues={filters}
        onFilterChange={(k, v) => setFilters(s => ({ ...s, [k]: v }))}
        rows={filtered} columns={columns} exportName="maintenance"
        importTable="maintenance_logs" canImport={isManager}
        importRequiredColumns={["Vehicle", "Description", "Start", "Status"]}
        importTransform={(r) => ({
          vehicle_id:  r["Vehicle"]     ?? r["vehicle_id"]  ?? null,
          description: r["Description"] ?? r["description"] ?? "",
          start_date:  r["Start"]       ?? r["start_date"]  ?? "",
          end_date:    (r["End"]        ?? r["end_date"]    ?? "") || null,
          cost:        Number(r["Cost"] ?? r["cost"])       || 0,
          status:      r["Status"]      ?? r["status"]      ?? "ACTIVE",
        })}
        onImportDone={() => qc.invalidateQueries({ queryKey: ["maintenance_logs"] })}
      />

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-muted/50">
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="text-left font-normal px-6 py-3">Vehicle</th>
                <th className="text-left font-normal px-4 py-3">Description</th>
                <th className="text-left font-normal px-4 py-3">Start</th>
                <th className="text-left font-normal px-4 py-3">End</th>
                <th className="text-right font-normal px-4 py-3">Cost</th>
                <th className="text-left font-normal px-4 py-3">Status</th>
                <th className="text-right font-normal px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</td></tr>
              ) : filtered.map(m => {
                const v = vehicles.find(x => x.id === m.vehicle_id);
                return (
                  <tr key={m.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 font-mono text-xs">{v?.registration_number ?? "—"}</td>
                    <td className="px-4 py-4">{m.description}</td>
                    <td className="px-4 py-4 tabular text-xs">{m.start_date}</td>
                    <td className="px-4 py-4 tabular text-xs">{m.end_date ?? "—"}</td>
                    <td className="px-4 py-4 text-right tabular">₹{m.cost.toLocaleString()}</td>
                    <td className="px-4 py-4"><StatusPill status={m.status} /></td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <EditButton title="Edit work order" fields={fields} row={m} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v as any)} />
                        <DeleteButton disabled={!isManager} onConfirm={() => del.mutateAsync(m.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">No work orders match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
