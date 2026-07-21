import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { bulkInsert } from "@/lib/data-hooks";

export type ColumnDef<T> = {
  key: keyof T & string;
  label: string;
  format?: (v: any, row: T) => string;
};

export function exportCsv<T extends Record<string, any>>(filename: string, rows: T[], columns: ColumnDef<T>[]) {
  const data = rows.map((r) => {
    const o: Record<string, any> = {};
    for (const c of columns) o[c.label] = c.format ? c.format(r[c.key], r) : (r[c.key] ?? "");
    return o;
  });
  const csv = Papa.unparse(data);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export function exportPdf<T extends Record<string, any>>(title: string, rows: T[], columns: ColumnDef<T>[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  const now = new Date().toLocaleString();
  doc.setFontSize(16);
  doc.text("TransitOps", 14, 15);
  doc.setFontSize(11);
  doc.text(title, 14, 22);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${now} · ${rows.length} record(s)`, 14, 27);
  doc.setTextColor(0);
  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(c.format ? c.format(r[c.key], r) : (r[c.key] ?? "")))),
    startY: 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [23, 23, 23], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 244, 240] },
  });
  doc.save(`${title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function importCsv(
  table: string,
  file: File,
  transform?: (row: Record<string, any>) => Record<string, any> | null,
  requiredColumns?: string[],
): Promise<{ inserted: number; failed: number }> {
  // Reject non-CSV files immediately
  if (!file.name.toLowerCase().endsWith(".csv") && !file.type.includes("csv")) {
    toast.error("Invalid file type. Please upload a .csv file.");
    return { inserted: 0, failed: 0 };
  }

  return new Promise((resolve) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        // ── Format validation ──
        const headers = result.meta.fields ?? [];
        if (headers.length === 0) {
          toast.error("CSV has no column headers. Check the file format.");
          resolve({ inserted: 0, failed: 0 }); return;
        }

        // If requiredColumns specified, validate at least 1 required column is present
        if (requiredColumns && requiredColumns.length > 0) {
          const normalised = headers.map(h => h.trim().toLowerCase());
          const missing = requiredColumns.filter(
            rc => !normalised.includes(rc.toLowerCase())
          );
          if (missing.length === requiredColumns.length) {
            toast.error(
              `Wrong CSV format. Expected columns like: ${requiredColumns.slice(0, 4).join(", ")}. Got: ${headers.slice(0, 4).join(", ")}.`
            );
            resolve({ inserted: 0, failed: 0 }); return;
          }
        }

        // ── Data transformation ──
        const rows = (result.data || [])
          .map((r) => {
            const cleaned: Record<string, any> = {};
            for (const [k, v] of Object.entries(r)) {
              const key = k.trim();
              if (!key) continue;
              if (v === "" || v === null || v === undefined) continue;
              cleaned[key] = v;
            }
            delete cleaned.id;
            delete cleaned.created_at;
            delete cleaned.updated_at;
            return transform ? transform(cleaned) : cleaned;
          })
          .filter((r): r is Record<string, any> => !!r && Object.keys(r).length > 0);

        if (rows.length === 0) {
          toast.error("No valid rows found in CSV. Check the file has data rows and the correct format.");
          resolve({ inserted: 0, failed: 0 }); return;
        }

        const { inserted, failed } = await bulkInsert(table, rows);
        if (inserted > 0) {
          toast.success(`Imported ${inserted} row(s)${failed ? ` · ${failed} failed` : ""} into ${table}.`);
        } else {
          toast.error(`Import failed — ${failed} row(s) could not be saved. Check your network connection.`);
        }
        resolve({ inserted, failed });
      },
      error: (err) => {
        toast.error(`CSV parse error: ${err.message}. Please check the file format.`);
        resolve({ inserted: 0, failed: 1 });
      },
    });
  });
}


export function coerceRow(row: Record<string, any>, spec: Record<string, "string" | "number" | "boolean" | "date">) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const t = spec[k];
    if (t === "number") { const n = Number(v); out[k] = Number.isFinite(n) ? n : null; }
    else if (t === "boolean") { out[k] = /^(true|1|yes)$/i.test(String(v)); }
    else if (t === "date") { out[k] = v; }
    else out[k] = v;
  }
  return out;
}
