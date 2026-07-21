import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ref, get } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";
import { SectionHeader, Panel } from "@/components/ui-bits";
import { DataToolbar } from "@/components/data-toolbar";
import type { ColumnDef } from "@/lib/data-tools";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit log — TransitOps" }] }),
  component: Audit,
});

type AuditRow = {
  id: string; table_name: string; record_id: string | null; action: string;
  actor_id: string | null; actor_email: string | null;
  old_data: any; new_data: any; created_at: string;
};

const ACTION_STYLE: Record<string, string> = {
  INSERT: "bg-success/10 text-success border-success/30",
  UPDATE: "bg-info/10 text-info border-info/30",
  DELETE: "bg-destructive/10 text-destructive border-destructive/30",
};

function summarize(action: string, oldData: any, newData: any) {
  const target = newData ?? oldData ?? {};
  const label = target.name ?? target.registration_number ?? target.description ?? target.source ?? target.id?.slice?.(0, 8);
  if (action === "UPDATE" && oldData && newData) {
    const changes: string[] = [];
    for (const k of Object.keys(newData)) {
      if (["updated_at", "created_at"].includes(k)) continue;
      if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) changes.push(k);
    }
    return `${label ?? "record"} · ${changes.slice(0, 4).join(", ") || "changed"}${changes.length > 4 ? "…" : ""}`;
  }
  return label ?? "record";
}

function Audit() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground text-sm">
        Access Denied. Only system administrators can view the audit log.
      </div>
    );
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const snap = await get(ref(rtdb, "audit_logs"));
      const val = snap.val() as Record<string, Omit<AuditRow, "id">> | null;
      if (!val) return [] as AuditRow[];
      return Object.entries(val)
        .map(([id, v]) => ({ id, ...v } as AuditRow))
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 500);
    },
  });

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((r) => {
      if (filters.table && filters.table !== "all" && r.table_name !== filters.table) return false;
      if (filters.action && filters.action !== "all" && r.action !== filters.action) return false;
      if (q) {
        const hay = `${r.actor_email ?? ""} ${r.table_name} ${r.action} ${JSON.stringify(r.new_data ?? r.old_data ?? "")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, filters]);

  const columns: ColumnDef<AuditRow>[] = [
    { key: "created_at", label: "When", format: (v) => v ? new Date(v).toLocaleString() : "" },
    { key: "actor_email", label: "Actor", format: (v) => v ?? "system" },
    { key: "table_name", label: "Table" },
    { key: "action", label: "Action" },
    { key: "record_id", label: "Record", format: (v) => v?.slice(0, 8) ?? "" },
    { key: "id", label: "Summary", format: (_v, r) => summarize(r.action, r.old_data, r.new_data) },
  ];

  return (
    <div className="px-6 py-8 max-w-[1600px]">
      <SectionHeader
        eyebrow="Compliance" title="Audit log"
        description="Every create, edit, and delete across core tables — with the actor and payload."
      />

      <DataToolbar
        search={search} onSearch={setSearch} searchPlaceholder="Search actor, payload…"
        filters={[
          { name: "table", label: "Table", options: [
            { label: "Vehicles", value: "vehicles" }, { label: "Drivers", value: "drivers" },
            { label: "Trips", value: "trips" }, { label: "Fuel logs", value: "fuel_logs" },
            { label: "Maintenance", value: "maintenance_logs" },
          ]},
          { name: "action", label: "Action", options: [
            { label: "Insert", value: "INSERT" }, { label: "Update", value: "UPDATE" }, { label: "Delete", value: "DELETE" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
        rows={filtered} columns={columns} exportName="audit_log"
      />

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Table</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading && <tr><td className="px-4 py-8 text-muted-foreground" colSpan={5}>Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td className="px-4 py-8 text-muted-foreground" colSpan={5}>No audit events.</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 tabular text-xs text-muted-foreground whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</td>
                  <td className="px-4 py-3 text-xs">{r.actor_email ?? <span className="text-muted-foreground">system</span>}</td>
                  <td className="px-4 py-3 text-xs font-mono">{r.table_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-widest ${ACTION_STYLE[r.action] ?? ""}`}>{r.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{summarize(r.action, r.old_data, r.new_data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
