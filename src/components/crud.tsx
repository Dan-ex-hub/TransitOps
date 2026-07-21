import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

export type FieldDef =
  | { name: string; label: string; type: "text" | "number" | "date"; required?: boolean; placeholder?: string }
  | { name: string; label: string; type: "select"; options: { label: string; value: string }[]; required?: boolean };

export function EntityForm<T extends Record<string, any>>({
  fields, initial, onSubmit, submitLabel,
}: {
  fields: FieldDef[]; initial?: Partial<T>; submitLabel: string;
  onSubmit: (v: Record<string, any>) => Promise<void> | void;
}) {
  const [values, setValues] = useState<Record<string, any>>({ ...initial });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const clean: Record<string, any> = {};
          for (const f of fields) {
            const v = values[f.name];
            if (v === "" || v === undefined) { clean[f.name] = null; continue; }
            clean[f.name] = f.type === "number" ? Number(v) : v;
          }
          await onSubmit(clean);
        } finally { setBusy(false); }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.type === "text" && f.name.length > 20 ? "sm:col-span-2" : ""}>
            <Label htmlFor={f.name}>{f.label}</Label>
            {f.type === "select" ? (
              <Select value={values[f.name] ?? ""} onValueChange={(v) => setValues(s => ({ ...s, [f.name]: v }))}>
                <SelectTrigger id={f.name}><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                <SelectContent>
                  {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={f.name} type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                required={f.required} placeholder={(f as any).placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues(s => ({ ...s, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy}>{busy ? "…" : submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}

export function CreateButton({
  title, fields, onSubmit, disabled, trigger,
}: {
  title: string; fields: FieldDef[]; disabled?: boolean;
  onSubmit: (v: Record<string, any>) => Promise<void>;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={disabled} className="gap-2"><Plus className="h-4 w-4" /> New</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <EntityForm fields={fields} submitLabel="Create" onSubmit={async (v) => {
          try { await onSubmit(v); toast.success("Created"); setOpen(false); }
          catch (e: any) { toast.error(e.message ?? "Failed"); }
        }} />
      </DialogContent>
    </Dialog>
  );
}

export function EditButton<T extends Record<string, any>>({
  title, fields, row, onSubmit, disabled,
}: {
  title: string; fields: FieldDef[]; row: T; disabled?: boolean;
  onSubmit: (v: Record<string, any>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <EntityForm fields={fields} initial={row} submitLabel="Save changes" onSubmit={async (v) => {
          try { await onSubmit({ ...v, id: row.id }); toast.success("Saved"); setOpen(false); }
          catch (e: any) { toast.error(e.message ?? "Failed"); }
        }} />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteButton({ onConfirm, disabled }: { onConfirm: () => Promise<void>; disabled?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this record?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            try { await onConfirm(); toast.success("Deleted"); } catch (e: any) { toast.error(e.message ?? "Failed"); }
          }}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
