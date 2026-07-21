import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader, StatusPill } from "@/components/ui-bits";
import { useVehicles, useUpsert, useDelete, type Vehicle } from "@/lib/data-hooks";
import { CreateButton, EditButton, DeleteButton, type FieldDef } from "@/components/crud";
import { DataToolbar } from "@/components/data-toolbar";
import { useAuth } from "@/lib/auth-context";
import { coerceRow, type ColumnDef } from "@/lib/data-tools";

export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({ meta: [{ title: "Fleet — TransitOps" }] }),
  component: Fleet,
});

const FIELDS: FieldDef[] = [
  { name: "registration_number", label: "Registration", type: "text", required: true, placeholder: "MH-01-AB-1234" },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "model", label: "Model", type: "text" },
  { name: "type", label: "Type", type: "select", options: [
    { label: "Heavy Truck", value: "Heavy Truck" }, { label: "Medium Truck", value: "Medium Truck" }, { label: "Light Truck", value: "Light Truck" },
  ], required: true },
  { name: "region", label: "Region", type: "select", options: [
    { label: "West", value: "West" }, { label: "North", value: "North" }, { label: "South", value: "South" }, { label: "East", value: "East" },
  ], required: true },
  { name: "max_load_capacity", label: "Capacity (kg)", type: "number" },
  { name: "odometer", label: "Odometer (km)", type: "number" },
  { name: "acquisition_cost", label: "Cost basis (₹)", type: "number" },
  { name: "status", label: "Status", type: "select", options: [
    { label: "Available", value: "AVAILABLE" }, { label: "On trip", value: "ON_TRIP" },
    { label: "In shop", value: "IN_SHOP" }, { label: "Retired", value: "RETIRED" },
  ], required: true },
];

const COLUMNS: ColumnDef<Vehicle>[] = [
  { key: "registration_number", label: "Registration" },
  { key: "name", label: "Name" },
  { key: "model", label: "Model" },
  { key: "type", label: "Type" },
  { key: "region", label: "Region" },
  { key: "max_load_capacity", label: "Capacity (kg)" },
  { key: "odometer", label: "Odometer" },
  { key: "acquisition_cost", label: "Cost" },
  { key: "status", label: "Status" },
];

function Fleet() {
  const { isManager, isDriver } = useAuth();
  if (isDriver) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground text-sm">
        Access Denied. Drivers do not have access to the Fleet register.
      </div>
    );
  }

  const { data = [], isLoading } = useVehicles();
  const upsert = useUpsert<Vehicle>("vehicles");
  const del = useDelete("vehicles");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((v) => {
      if (filters.status && filters.status !== "all" && v.status !== filters.status) return false;
      if (filters.region && filters.region !== "all" && v.region !== filters.region) return false;
      if (filters.type && filters.type !== "all" && v.type !== filters.type) return false;
      if (q && !`${v.registration_number} ${v.name} ${v.model ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, filters]);

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="Assets" title="Fleet register"
        description="Every vehicle, its region, and its current lifecycle state."
        actions={<CreateButton title="Add vehicle" fields={FIELDS} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v)} />}
      />

      <DataToolbar
        search={search} onSearch={setSearch} searchPlaceholder="Search registration, name…"
        filters={[
          { name: "status", label: "Status", options: [
            { label: "Available", value: "AVAILABLE" }, { label: "On trip", value: "ON_TRIP" },
            { label: "In shop", value: "IN_SHOP" }, { label: "Retired", value: "RETIRED" },
          ]},
          { name: "region", label: "Region", options: ["West","North","South","East"].map(x => ({label:x,value:x})) },
          { name: "type", label: "Type", options: ["Heavy Truck","Medium Truck","Light Truck"].map(x => ({label:x,value:x})) },
        ]}
        filterValues={filters}
        onFilterChange={(k, v) => setFilters(s => ({ ...s, [k]: v }))}
        rows={filtered} columns={COLUMNS} exportName="fleet"
        importTable="vehicles" canImport={isManager}
        importRequiredColumns={["Registration", "Name", "Type", "Status"]}
        importTransform={(r) => ({
          registration_number: r["Registration"]    ?? r["registration_number"] ?? "",
          name:                r["Name"]            ?? r["name"]                ?? "",
          model:               r["Model"]           ?? r["model"]               ?? null,
          type:                r["Type"]            ?? r["type"]                ?? "",
          region:              r["Region"]          ?? r["region"]              ?? "",
          max_load_capacity:   Number(r["Capacity (kg)"] ?? r["max_load_capacity"]) || 0,
          odometer:            Number(r["Odometer"]      ?? r["odometer"])          || 0,
          acquisition_cost:    Number(r["Cost"]          ?? r["acquisition_cost"]) || 0,
          status:              r["Status"]          ?? r["status"]              ?? "AVAILABLE",
        })}
        onImportDone={() => qc.invalidateQueries({ queryKey: ["vehicles"] })}
      />

      {isLoading ? <div className="text-sm text-muted-foreground">Loading fleet…</div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(v => (
            <Panel key={v.id} className="p-5 hover:border-line-strong transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{v.type} · {v.region}</div>
                  <div className="font-display text-2xl mt-1 truncate">{v.name}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{v.registration_number}</div>
                </div>
                <StatusPill status={v.status} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Odometer</div><div className="mt-0.5 tabular">{(v.odometer/1000).toFixed(1)}k km</div></div>
                <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Capacity</div><div className="mt-0.5 tabular">{(v.max_load_capacity/1000).toFixed(1)} t</div></div>
                <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost</div><div className="mt-0.5 tabular">₹{(v.acquisition_cost/100000).toFixed(1)}L</div></div>
              </div>
              <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{v.model}</span>
                <div className="flex items-center gap-1">
                  <EditButton title="Edit vehicle" fields={FIELDS} row={v} disabled={!isManager} onSubmit={(x) => upsert.mutateAsync(x as any)} />
                  <DeleteButton disabled={!isManager} onConfirm={() => del.mutateAsync(v.id)} />
                </div>
              </div>
            </Panel>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No vehicles match.</div>}
        </div>
      )}
    </div>
  );
}
