import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ref, get, push, set, update, remove, serverTimestamp } from "firebase/database";
import { rtdb, auth } from "@/integrations/firebase/client";

export type Vehicle = {
  id: string; registration_number: string; name: string; model: string | null;
  type: string; max_load_capacity: number; odometer: number; acquisition_cost: number;
  status: string; region: string;
};
export type Driver = {
  id: string; name: string; license_number: string; license_category: string;
  license_expiry_date: string; contact_number: string | null; safety_score: number; status: string;
};
export type Trip = {
  id: string; source: string; source_region: string | null;
  destination: string; destination_region: string | null;
  vehicle_id: string | null; driver_id: string | null;
  cargo_weight: number; planned_distance: number;
  actual_distance: number | null; fuel_consumed: number | null; revenue: number | null;
  status: string; dispatched_at: string | null; completed_at: string | null;
};
export type FuelLog = {
  id: string; vehicle_id: string | null; trip_id: string | null;
  liters: number; cost: number; date: string;
  anomaly_flag: boolean; anomaly_reason: string | null;
};
export type MaintenanceLog = {
  id: string; vehicle_id: string | null; description: string; cost: number;
  status: string; start_date: string; end_date: string | null;
};

async function readTable<T>(table: string): Promise<T[]> {
  const snap = await get(ref(rtdb, table));
  const val = snap.val() as Record<string, Omit<T, "id">> | null;
  if (!val) return [];
  return Object.entries(val).map(([id, v]) => ({ id, ...(v as any) })) as T[];
}

function useTable<T>(table: string, sortKey?: string) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const rows = await readTable<T>(table);
      const key = (sortKey ?? "created_at") as keyof T;
      return rows.sort((a: any, b: any) => {
        const av = a[key] ?? a.id; const bv = b[key] ?? b.id;
        return String(bv).localeCompare(String(av));
      });
    },
  });
}

export const useVehicles = () => useTable<Vehicle>("vehicles");
export const useDrivers = () => useTable<Driver>("drivers");
export const useTrips = () => useTable<Trip>("trips", "dispatched_at");
export const useFuelLogs = () => useTable<FuelLog>("fuel_logs", "date");
export const useMaintenance = () => useTable<MaintenanceLog>("maintenance_logs", "start_date");

async function writeAudit(table: string, action: "INSERT" | "UPDATE" | "DELETE", record_id: string, old_data: any, new_data: any) {
  const u = auth.currentUser;
  try {
    await push(ref(rtdb, "audit_logs"), {
      table_name: table,
      action,
      record_id,
      actor_id: u?.uid ?? null,
      actor_email: u?.email ?? null,
      old_data: old_data ?? null,
      new_data: new_data ?? null,
      created_at: new Date().toISOString(),
      created_ts: serverTimestamp(),
    });
  } catch (e) { console.error("audit write failed", e); }
}

export function useUpsert<T extends { id?: string }>(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<T>) => {
      const now = new Date().toISOString();
      if ((row as any).id) {
        const { id, ...rest } = row as any;
        const nodeRef = ref(rtdb, `${table}/${id}`);
        const prev = (await get(nodeRef)).val();
        await update(nodeRef, { ...rest, updated_at: now });
        await writeAudit(table, "UPDATE", id, prev, { ...prev, ...rest });
      } else {
        const created = await push(ref(rtdb, table), { ...(row as any), created_at: now, updated_at: now });
        await writeAudit(table, "INSERT", created.key!, null, { ...(row as any), id: created.key });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export function useDelete(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const nodeRef = ref(rtdb, `${table}/${id}`);
      const prev = (await get(nodeRef)).val();
      await remove(nodeRef);
      await writeAudit(table, "DELETE", id, prev, null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

// Bulk insert helper (used by CSV import) — writes audit as INSERT per row
export async function bulkInsert(table: string, rows: Record<string, any>[]): Promise<{ inserted: number; failed: number }> {
  let inserted = 0, failed = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    try {
      const created = await push(ref(rtdb, table), { ...row, created_at: now, updated_at: now });
      await writeAudit(table, "INSERT", created.key!, null, { ...row, id: created.key });
      inserted++;
    } catch (e) {
      console.error("bulk insert failed", row, e);
      failed++;
    }
  }
  return { inserted, failed };
}

export async function setSelfDisplayNameInProfile() { /* no-op, handled in auth-context */ }
