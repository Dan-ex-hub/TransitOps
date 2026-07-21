import type { ReactNode } from "react";

export function StatCard({
  label, value, delta, sub, accent,
}: { label: string; value: ReactNode; delta?: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`relative p-5 border border-line bg-card rounded-lg ${accent ? "ring-1 ring-accent/40" : ""}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-3 font-display text-4xl leading-none tabular">{value}</div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{sub}</span>
        {delta && (
          <span className={`text-xs tabular ${delta.startsWith("-") ? "text-destructive" : "text-success"}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-success/10 text-success border-success/30",
  ON_TRIP: "bg-info/10 text-info border-info/30",
  DISPATCHED: "bg-info/10 text-info border-info/30",
  IN_SHOP: "bg-warning/15 text-warning border-warning/40",
  RETIRED: "bg-muted text-muted-foreground border-line",
  OFF_DUTY: "bg-muted text-muted-foreground border-line",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/30",
  COMPLETED: "bg-success/10 text-success border-success/30",
  DRAFT: "bg-muted text-ink-soft border-line-strong",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
  ACTIVE: "bg-warning/15 text-warning border-warning/40",
  CLOSED: "bg-success/10 text-success border-success/30",
};

export function StatusPill({ status }: { status?: string | null }) {
  const s = status ?? "UNKNOWN";
  const cls = STATUS_STYLES[s] ?? "bg-muted text-ink-soft border-line";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.14em] ${cls}`}>
      <span className="h-1 w-1 rounded-full bg-current" />
      {s.replace(/_/g, " ")}
    </span>
  );
}

export function SectionHeader({
  eyebrow, title, description, actions,
}: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:items-end sm:justify-between mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">{eyebrow}</div>}
        <h2 className="font-display text-3xl leading-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-line bg-card rounded-lg ${className}`}>{children}</div>;
}
