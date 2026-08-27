"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/components/SessionProvider";

interface Tenant {
  id: string;
  name: string;
  brandName: string;
  primaryColor: string;
  logoUrl?: string;
  supportEmail?: string;
}

export default function AdminPage() {
  const { refresh } = useSession();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ tenant: Tenant }>("/api/tenant").then((d) => setTenant(d.tenant));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setError(null);
    setSaved(false);
    try {
      await apiFetch("/api/tenant", {
        method: "PATCH",
        body: JSON.stringify({
          brandName: tenant.brandName,
          primaryColor: tenant.primaryColor,
          logoUrl: tenant.logoUrl || "",
          supportEmail: tenant.supportEmail,
        }),
      });
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  if (!tenant) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">White-Label Branding</h1>
        <p className="text-sm text-slate-500 mt-1">
          This deployment is a single tenant (organization). Each client organization gets its own tenant row with independent branding — this is the white-label mechanism.
        </p>
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Brand name</label>
          <input value={tenant.brandName} onChange={(e) => setTenant({ ...tenant, brandName: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={tenant.primaryColor} onChange={(e) => setTenant({ ...tenant, primaryColor: e.target.value })} className="h-9 w-14 rounded border border-slate-300" />
            <input value={tenant.primaryColor} onChange={(e) => setTenant({ ...tenant, primaryColor: e.target.value })} className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL (optional)</label>
          <input value={tenant.logoUrl || ""} onChange={(e) => setTenant({ ...tenant, logoUrl: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="https://…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Support email</label>
          <input value={tenant.supportEmail || ""} onChange={(e) => setTenant({ ...tenant, supportEmail: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Saved.</p>}
        <button className="rounded-md text-white text-sm font-medium py-1.5 px-4" style={{ backgroundColor: tenant.primaryColor }}>
          Save branding
        </button>
      </form>
    </div>
  );
}
