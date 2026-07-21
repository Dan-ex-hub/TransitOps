import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader, StatusPill } from "@/components/ui-bits";
import { useTrips, useVehicles, useDrivers, useUpsert, useDelete, type Trip } from "@/lib/data-hooks";
import { CreateButton, EditButton, DeleteButton, type FieldDef } from "@/components/crud";
import { DataToolbar } from "@/components/data-toolbar";
import { useAuth } from "@/lib/auth-context";
import { coerceRow, type ColumnDef } from "@/lib/data-tools";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({ meta: [{ title: "Dispatch — TransitOps" }] }),
  component: Trips,
});

function Trips() {
  const { data = [], isLoading } = useTrips();
  const vehicles = useVehicles().data ?? [];
  const drivers = useDrivers().data ?? [];
  const upsert = useUpsert<Trip>("trips");
  const del = useDelete("trips");
  const { isManager } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const fields: FieldDef[] = [
    { name: "source", label: "Source", type: "text", required: true },
    { name: "destination", label: "Destination", type: "text", required: true },
    { name: "source_region", label: "Source region", type: "text" },
    { name: "destination_region", label: "Dest. region", type: "text" },
    { name: "vehicle_id", label: "Vehicle", type: "select", options: vehicles.map(v => ({ label: `${v.registration_number} · ${v.name}`, value: v.id })) },
    { name: "driver_id", label: "Driver", type: "select", options: drivers.map(d => ({ label: d.name, value: d.id })) },
    { name: "cargo_weight", label: "Cargo (kg)", type: "number" },
    { name: "planned_distance", label: "Distance (km)", type: "number" },
    { name: "revenue", label: "Revenue (₹)", type: "number" },
    { name: "status", label: "Status", type: "select", options: [
      { label: "Draft", value: "DRAFT" }, { label: "Dispatched", value: "DISPATCHED" },
      { label: "Completed", value: "COMPLETED" }, { label: "Cancelled", value: "CANCELLED" },
    ], required: true },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((t) => {
      if (filters.status && filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.region && filters.region !== "all" && t.source_region !== filters.region && t.destination_region !== filters.region) return false;
      if (q && !`${t.source} ${t.destination} ${t.source_region ?? ""} ${t.destination_region ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, filters]);

  const columns: { title: string; status: Trip["status"] }[] = [
    { title: "Draft", status: "DRAFT" }, { title: "Dispatched", status: "DISPATCHED" },
    { title: "Completed", status: "COMPLETED" }, { title: "Cancelled", status: "CANCELLED" },
  ];

  const exportColumns: ColumnDef<Trip>[] = [
    { key: "source", label: "Source" }, { key: "destination", label: "Destination" },
    { key: "source_region", label: "From region" }, { key: "destination_region", label: "To region" },
    { key: "cargo_weight", label: "Cargo (kg)" }, { key: "planned_distance", label: "Distance (km)" },
    { key: "revenue", label: "Revenue" }, { key: "status", label: "Status" },
  ];

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="Operations" title="Dispatch board"
        description="Trip lifecycle from draft to completion, in a single glance."
        actions={<CreateButton title="Plan trip" fields={fields} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v)} />}
      />

      <DataToolbar
        search={search} onSearch={setSearch} searchPlaceholder="Search source, destination…"
        filters={[
          { name: "status", label: "Status", options: columns.map(c => ({ label: c.title, value: c.status })) },
          { name: "region", label: "Region", options: ["West","North","South","East"].map(x => ({label:x,value:x})) },
        ]}
        filterValues={filters}
        onFilterChange={(k, v) => setFilters(s => ({ ...s, [k]: v }))}
        rows={filtered} columns={exportColumns} exportName="trips"
        importTable="trips" canImport={isManager}
        importRequiredColumns={["Source", "Destination", "Status"]}
        importTransform={(r) => ({
          source:             r["Source"]        ?? r["source"]         ?? "",
          source_region:      r["From region"]   ?? r["source_region"]  ?? null,
          destination:        r["Destination"]   ?? r["destination"]    ?? "",
          destination_region: r["To region"]     ?? r["destination_region"] ?? null,
          vehicle_id:         r["Vehicle"]       ?? r["vehicle_id"]     ?? null,
          driver_id:          r["Driver"]        ?? r["driver_id"]      ?? null,
          cargo_weight:       Number(r["Cargo (kg)"]   ?? r["cargo_weight"])      || 0,
          planned_distance:   Number(r["Distance (km)"]?? r["planned_distance"])  || 0,
          actual_distance:    r["Actual (km)"]   ? Number(r["Actual (km)"])  : null,
          fuel_consumed:      r["Fuel (L)"]      ? Number(r["Fuel (L)"])     : null,
          revenue:            r["Revenue"]       ? Number(r["Revenue"])      : null,
          status:             r["Status"]        ?? r["status"]         ?? "DRAFT",
          dispatched_at:      r["Dispatched"]    ?? r["dispatched_at"]  ?? null,
          completed_at:       r["Completed"]     ?? r["completed_at"]   ?? null,
        })}
        onImportDone={() => qc.invalidateQueries({ queryKey: ["trips"] })}
      />

      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="grid gap-4 lg:grid-cols-4">
          {columns.map(col => {
            const items = filtered.filter(t => t.status === col.status);
            return (
              <div key={col.status} className="min-w-0">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{col.title}</div>
                  <div className="text-xs tabular text-muted-foreground">{items.length}</div>
                </div>
                <div className="space-y-3">
                  {items.map(t => {
                    const v = vehicles.find(x => x.id === t.vehicle_id);
                    const d = drivers.find(x => x.id === t.driver_id);
                    return (
                      <Panel key={t.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{t.source} → {t.destination}</div>
                            <div className="text-[11px] text-muted-foreground">{t.source_region} · {t.destination_region}</div>
                          </div>
                          <StatusPill status={t.status} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <div className="tabular text-muted-foreground">{(t.cargo_weight / 1000).toFixed(1)}t · {t.planned_distance}km</div>
                          {t.revenue != null && <div className="tabular">₹{(t.revenue / 1000).toFixed(1)}k</div>}
                        </div>
                        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px]">
                          <div className="min-w-0 truncate">
                            <div className="text-muted-foreground truncate">{d?.name ?? "—"}</div>
                            <div className="font-mono text-muted-foreground truncate">{v?.registration_number ?? "—"}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <EditButton title="Edit trip" fields={fields} row={t} disabled={!isManager} onSubmit={(x) => upsert.mutateAsync(x as any)} />
                            <DeleteButton disabled={!isManager} onConfirm={() => del.mutateAsync(t.id)} />
                          </div>
                        </div>
                      </Panel>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="border border-dashed border-line rounded-md p-6 text-center text-xs text-muted-foreground">None</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
