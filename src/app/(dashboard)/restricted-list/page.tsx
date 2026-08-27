"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/api";

interface Item {
  id: string;
  securityName: string;
  isin?: string;
  reason?: string;
  addedBy: string;
  addedAt: string;
  removedAt?: string;
}

export default function RestrictedListPage() {
  const { user } = useSession();
  const canEdit = user?.role === "COMPLIANCE_OFFICER" || user?.role === "ADMIN";
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ securityName: "", isin: "", reason: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ items: Item[] }>("/api/restricted-list");
    setItems(data.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/restricted-list", { method: "POST", body: JSON.stringify(form) });
      setForm({ securityName: "", isin: "", reason: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/restricted-list/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Restricted List</h1>

      {canEdit && (
        <form onSubmit={addItem} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Security name</label>
            <input required value={form.securityName} onChange={(e) => setForm({ ...form, securityName: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ISIN (optional)</label>
            <input value={form.isin} onChange={(e) => setForm({ ...form, isin: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <button className="rounded-md text-white text-sm font-medium py-1.5 px-4" style={{ backgroundColor: "var(--brand, #1d4ed8)" }}>
            Add
          </button>
          {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Security</th>
              <th className="text-left px-4 py-2">ISIN</th>
              <th className="text-left px-4 py-2">Reason</th>
              <th className="text-left px-4 py-2">Added by</th>
              <th className="text-left px-4 py-2">Status</th>
              {canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{i.securityName}</td>
                <td className="px-4 py-2 text-slate-500">{i.isin || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{i.reason || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{i.addedBy}</td>
                <td className="px-4 py-2">
                  {i.removedAt ? (
                    <span className="text-xs text-slate-400">Removed</span>
                  ) : (
                    <span className="text-xs font-medium text-red-600">Restricted</span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-2 text-right">
                    {!i.removedAt && (
                      <button onClick={() => remove(i.id)} className="text-xs text-slate-400 hover:text-red-600">
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
