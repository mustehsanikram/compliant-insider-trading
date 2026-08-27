"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Trade {
  id: string;
  schemeName: string;
  securityName: string;
  isin?: string;
  transactionType: "BUY" | "SELL";
  quantity: number;
  tradeDate: string;
  loggedBy: string;
}

export default function SchemeTradesPage() {
  const [items, setItems] = useState<Trade[]>([]);
  const [form, setForm] = useState({ schemeName: "", securityName: "", isin: "", transactionType: "BUY", quantity: "", tradeDate: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ items: Trade[] }>("/api/scheme-trades");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTrade(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/scheme-trades", {
        method: "POST",
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      setForm({ schemeName: "", securityName: "", isin: "", transactionType: "BUY", quantity: "", tradeDate: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Scheme Trades (AMC Fund Activity)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Log the fund's own trades here. Every approved employee pre-clearance is automatically checked against this log for potential front-running (same security, within 7 days) — matches show up under Surveillance Alerts.
        </p>
      </div>

      <form onSubmit={addTrade} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Scheme name</label>
          <input required value={form.schemeName} onChange={(e) => setForm({ ...form, schemeName: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="e.g. Growth Equity Fund" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Security</label>
          <input required value={form.securityName} onChange={(e) => setForm({ ...form, securityName: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ISIN</label>
          <input value={form.isin} onChange={(e) => setForm({ ...form, isin: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select value={form.transactionType} onChange={(e) => setForm({ ...form, transactionType: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
          <input required type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Trade date</label>
          <input required type="date" value={form.tradeDate} onChange={(e) => setForm({ ...form, tradeDate: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <button className="rounded-md text-white text-sm font-medium py-1.5 px-4 sm:col-span-6 sm:w-fit" style={{ backgroundColor: "var(--brand, #1d4ed8)" }}>
          Log trade
        </button>
        {error && <p className="text-sm text-red-600 sm:col-span-6">{error}</p>}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Scheme</th>
              <th className="text-left px-4 py-2">Security</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Qty</th>
              <th className="text-left px-4 py-2">Trade date</th>
              <th className="text-left px-4 py-2">Logged by</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700">{t.schemeName}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{t.securityName}</td>
                <td className="px-4 py-2 text-slate-500">{t.transactionType}</td>
                <td className="px-4 py-2 text-slate-500">{t.quantity}</td>
                <td className="px-4 py-2 text-slate-500">{t.tradeDate}</td>
                <td className="px-4 py-2 text-slate-500">{t.loggedBy}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">No scheme trades logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
