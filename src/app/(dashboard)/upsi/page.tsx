"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Entry {
  id: string;
  subject: string;
  description: string;
  createdAt: string;
  madePublicAt?: string;
  contentHash: string;
  createdBy: string;
}

export default function UpsiPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [form, setForm] = useState({ subject: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ items: Entry[] }>("/api/upsi");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/upsi", { method: "POST", body: JSON.stringify(form) });
      setForm({ subject: "", description: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function markPublic(id: string) {
    await apiFetch(`/api/upsi/${id}`, { method: "PATCH", body: JSON.stringify({ action: "mark_public" }) });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">UPSI Register (Structured Digital Database)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Append-only log of non-public, price/NAV-sensitive information — corporate UPSI for listed-company clients, or portfolio/scheme decisions (upcoming large trades, subscription/redemption info) for mutual fund/AMC clients. Entries are hashed at creation time for tamper evidence and cannot be edited or deleted through the UI.
        </p>
      </div>

      <form onSubmit={addEntry} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full sm:w-96 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="e.g. Q2 FY26 earnings" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded-md text-white text-sm font-medium py-1.5 px-4" style={{ backgroundColor: "var(--brand, #1d4ed8)" }}>
          Log UPSI entry
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Subject</th>
              <th className="text-left px-4 py-2">Created</th>
              <th className="text-left px-4 py-2">By</th>
              <th className="text-left px-4 py-2">Hash</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {e.subject}
                  <p className="text-xs text-slate-400 font-normal mt-0.5 max-w-sm">{e.description}</p>
                </td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-500">{e.createdBy}</td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">{e.contentHash.slice(0, 12)}…</td>
                <td className="px-4 py-2">
                  {e.madePublicAt ? <span className="text-xs text-slate-400">Public</span> : <span className="text-xs font-medium text-red-600">Price-sensitive</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {!e.madePublicAt && (
                    <button onClick={() => markPublic(e.id)} className="text-xs text-slate-500 hover:text-emerald-700">Mark public</button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">No UPSI entries logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
