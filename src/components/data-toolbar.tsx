import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileText, Search, X } from "lucide-react";
import { exportCsv, exportPdf, importCsv, type ColumnDef } from "@/lib/data-tools";

export type FilterDef = { name: string; label: string; options: { label: string; value: string }[] };

export function DataToolbar<T extends Record<string, any>>({
  search, onSearch, searchPlaceholder = "Search…",
  filters = [], filterValues = {}, onFilterChange,
  rows, columns, exportName, importTable, importTransform, importRequiredColumns, canImport, onImportDone, extra,
}: {
  search: string; onSearch: (v: string) => void; searchPlaceholder?: string;
  filters?: FilterDef[]; filterValues?: Record<string, string>;
  onFilterChange?: (name: string, value: string) => void;
  rows: T[]; columns: ColumnDef<T>[]; exportName: string;
  importTable?: string; importTransform?: (r: Record<string, any>) => Record<string, any> | null;
  importRequiredColumns?: string[];
  canImport?: boolean; onImportDone?: () => void; extra?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasFilters = filters.length > 0;
  const activeFilters = Object.values(filterValues).filter((v) => v && v !== "all").length;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-line bg-background min-w-[220px] flex-1 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder}
          className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted-foreground"
        />
        {search && (
          <button onClick={() => onSearch("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {hasFilters && filters.map((f) => (
        <Select key={f.name} value={filterValues[f.name] ?? "all"} onValueChange={(v) => onFilterChange?.(f.name, v)}>
          <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder={f.label} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
            {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {activeFilters > 0 && (
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{rows.length} match{rows.length === 1 ? "" : "es"}</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {extra}
        <Button variant="outline" size="sm" onClick={() => exportCsv(exportName, rows, columns)} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportPdf(exportName, rows, columns)} className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        {importTable && (
          <>
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await importCsv(importTable, f, importTransform, importRequiredColumns);
                if (fileRef.current) fileRef.current.value = "";
                onImportDone?.();
              }}
            />
            <Button variant="outline" size="sm" disabled={!canImport} onClick={() => fileRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
