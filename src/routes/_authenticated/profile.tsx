import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SectionHeader, Panel } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, updateDisplayName } from "@/lib/auth-context";
import { updatePassword } from "firebase/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — TransitOps" }] }),
  component: Profile,
});

function Profile() {
  const { user, displayName, roles } = useAuth();
  const [name, setName] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(displayName ?? ""); }, [displayName]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await updateDisplayName(user, name);
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally { setSaving(false); }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const pw = String(fd.get("password") ?? "");
    if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    try {
      await updatePassword(user, pw);
      toast.success("Password updated");
      form.reset();
    } catch (err: any) {
      toast.error(err.message ?? "Failed. You may need to sign in again.");
    }
  }

  const initials = (name || user?.email || "U").split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  return (
    <div className="px-6 py-8 max-w-4xl">
      <SectionHeader eyebrow="Account" title="Your profile" description="Manage identity, credentials, and roles." />
      <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <Panel className="p-6 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-accent-soft text-accent grid place-items-center text-2xl font-display">{initials}</div>
          <div className="mt-4 font-display text-xl">{name || "Unnamed"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{user?.email}</div>
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            {roles.length ? roles.map((r) => (
              <span key={r} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-soft text-accent">{r}</span>
            )) : <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">viewer</span>}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Identity</div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled />
              </div>
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Change password</div>
            <form onSubmit={changePassword} className="space-y-3">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" placeholder="At least 6 characters" minLength={6} required />
              </div>
              <Button type="submit" variant="outline">Update password</Button>
            </form>
          </Panel>

          <Panel className="p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">User ID</div>
            <div className="font-mono text-xs text-muted-foreground break-all">{user?.uid}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
