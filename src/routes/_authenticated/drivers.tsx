import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader, StatusPill } from "@/components/ui-bits";
import { useDrivers, useUpsert, useDelete, type Driver } from "@/lib/data-hooks";
import { CreateButton, EditButton, DeleteButton, type FieldDef } from "@/components/crud";
import { DataToolbar } from "@/components/data-toolbar";
import { useAuth } from "@/lib/auth-context";
import { coerceRow, type ColumnDef } from "@/lib/data-tools";

export const Route = createFileRoute("/_authenticated/drivers")({
  head: () => ({ meta: [{ title: "Drivers — TransitOps" }] }),
  component: Drivers,
});

const FIELDS: FieldDef[] = [
  { name: "name", label: "Full name", type: "text", required: true },
  { name: "license_number", label: "License #", type: "text", required: true },
  { name: "license_category", label: "Category", type: "select", options: [
    { label: "HGV", value: "HGV" }, { label: "MGV", value: "MGV" }, { label: "LGV", value: "LGV" },
  ], required: true },
  { name: "license_expiry_date", label: "License expiry", type: "date", required: true },
  { name: "contact_number", label: "Contact", type: "text" },
  { name: "safety_score", label: "Safety score", type: "number" },
  { name: "status", label: "Status", type: "select", options: [
    { label: "Available", value: "AVAILABLE" }, { label: "On trip", value: "ON_TRIP" },
    { label: "Off duty", value: "OFF_DUTY" }, { label: "Suspended", value: "SUSPENDED" },
  ], required: true },
];

const COLUMNS: ColumnDef<Driver>[] = [
  { key: "name", label: "Name" },
  { key: "license_number", label: "License" },
  { key: "license_category", label: "Category" },
  { key: "license_expiry_date", label: "Expiry" },
  { key: "contact_number", label: "Contact" },
  { key: "safety_score", label: "Safety" },
  { key: "status", label: "Status" },
];

function Drivers() {
  const { isManager } = useAuth();
  if (!isManager) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground text-sm">
        Access Denied. You do not have permission to view this page.
      </div>
    );
  }

  const { data = [], isLoading } = useDrivers();
  const upsert = useUpsert<Driver>("drivers");
  const del = useDelete("drivers");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((d) => {
      if (filters.status && filters.status !== "all" && d.status !== filters.status) return false;
      if (filters.category && filters.category !== "all" && d.license_category !== filters.category) return false;
      if (filters.expiry === "expiring") {
        if (new Date(d.license_expiry_date) >= new Date(Date.now() + 90 * 24 * 3600 * 1000)) return false;
      }
      if (q && !`${d.name} ${d.license_number} ${d.contact_number ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, filters]);

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="People" title="Driver roster"
        description="Certifications, safety scores and current duty state."
        actions={<CreateButton title="Add driver" fields={FIELDS} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v)} />}
      />

      <DataToolbar
        search={search} onSearch={setSearch} searchPlaceholder="Search name, license…"
        filters={[
          { name: "status", label: "Status", options: [
            { label: "Available", value: "AVAILABLE" }, { label: "On trip", value: "ON_TRIP" },
            { label: "Off duty", value: "OFF_DUTY" }, { label: "Suspended", value: "SUSPENDED" },
          ]},
          { name: "category", label: "Category", options: [
            { label: "HGV", value: "HGV" }, { label: "MGV", value: "MGV" }, { label: "LGV", value: "LGV" },
          ]},
          { name: "expiry", label: "Expiry", options: [{ label: "Expiring 90d", value: "expiring" }] },
        ]}
        filterValues={filters}
        onFilterChange={(k, v) => setFilters(s => ({ ...s, [k]: v }))}
        rows={filtered} columns={COLUMNS} exportName="drivers"
        importTable="drivers" canImport={isManager}
        importRequiredColumns={["Name", "License", "Category", "Status"]}
        importTransform={(r) => ({
          name:                r["Name"]     ?? r["name"]                ?? "",
          license_number:      r["License"]  ?? r["license_number"]      ?? "",
          license_category:    r["Category"] ?? r["license_category"]    ?? "",
          license_expiry_date: r["Expiry"]   ?? r["license_expiry_date"] ?? "",
          contact_number:      r["Contact"]  ?? r["contact_number"]      ?? null,
          safety_score:        Number(r["Safety"] ?? r["safety_score"])  || 0,
          status:              r["Status"]   ?? r["status"]              ?? "AVAILABLE",
        })}
        onImportDone={() => qc.invalidateQueries({ queryKey: ["drivers"] })}
      />

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-muted/50">
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="text-left font-normal px-6 py-3">Driver</th>
                <th className="text-left font-normal px-4 py-3">License</th>
                <th className="text-left font-normal px-4 py-3">Expiry</th>
                <th className="text-right font-normal px-4 py-3">Safety</th>
                <th className="text-left font-normal px-4 py-3">Status</th>
                <th className="text-right font-normal px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</td></tr>
              ) : filtered.map(d => {
                const expiring = new Date(d.license_expiry_date) < new Date(Date.now() + 90 * 24 * 3600 * 1000);
                return (
                  <tr key={d.id} className="border-b border-line last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground">{d.contact_number}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{d.license_number} <span className="text-muted-foreground">· {d.license_category}</span></td>
                    <td className={`px-4 py-4 tabular text-xs ${expiring ? "text-destructive" : ""}`}>{d.license_expiry_date}</td>
                    <td className="px-4 py-4 text-right tabular">{d.safety_score}</td>
                    <td className="px-4 py-4"><StatusPill status={d.status} /></td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <EditButton title="Edit driver" fields={FIELDS} row={d} disabled={!isManager} onSubmit={(v) => upsert.mutateAsync(v as any)} />
                        <DeleteButton disabled={!isManager} onConfirm={() => del.mutateAsync(d.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">No drivers match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
