"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/api";

interface Request {
  id: string;
  security_name?: string;
  securityName?: string;
  transaction_type?: string;
  transactionType?: string;
  quantity: number;
  status: string;
  requested_at?: string;
  requestedAt?: string;
  requesterName?: string;
  requesterEmail?: string;
}

interface WindowInfo {
  status: "OPEN" | "CLOSED";
  reason?: string;
}

export default function PreclearancePage() {
  const { user } = useSession();
  const isReviewer = user?.role === "COMPLIANCE_OFFICER" || user?.role === "ADMIN";
  const [items, setItems] = useState<Request[]>([]);
  const [win, setWin] = useState<WindowInfo | null>(null);
  const [form, setForm] = useState({ securityName: "", isin: "", transactionType: "BUY", quantity: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ items: Request[] }>("/api/preclearance");
    setItems(data.items);
    const w = await apiFetch<{ current: WindowInfo | null }>("/api/trading-window");
    setWin(w.current);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/preclearance", {
        method: "POST",
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      setForm({ securityName: "", isin: "", transactionType: "BUY", quantity: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    await apiFetch(`/api/preclearance/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) });
    load();
  }

  async function toggleWindow(status: "OPEN" | "CLOSED") {
    await apiFetch("/api/trading-window", {
      method: "POST",
      body: JSON.stringify({ status, startsAt: new Date().toISOString(), reason: status === "CLOSED" ? "Manually closed by compliance" : "Manually opened by compliance" }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Pre-Clearance</h1>
        {win && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${win.status === "CLOSED" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            Trading window: {win.status}
          </span>
        )}
      </div>

      {isReviewer && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-slate-600">Trading window control:</span>
          <button onClick={() => toggleWindow("OPEN")} className="text-xs rounded-md px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
            Open window
          </button>
          <button onClick={() => toggleWindow("CLOSED")} className="text-xs rounded-md px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100">
            Close window
          </button>
        </div>
      )}

      {!isReviewer && (
        <form onSubmit={submitRequest} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
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
          <button className="rounded-md text-white text-sm font-medium py-1.5 px-4" style={{ backgroundColor: "var(--brand, #1d4ed8)" }}>
            Request
          </button>
          {error && <p className="text-sm text-red-600 sm:col-span-5">{error}</p>}
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              {isReviewer && <th className="text-left px-4 py-2">Requester</th>}
              <th className="text-left px-4 py-2">Security</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Qty</th>
              <th className="text-left px-4 py-2">Status</th>
              {isReviewer && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {isReviewer && <td className="px-4 py-2 text-slate-600">{r.requesterName} <span className="text-slate-400">({r.requesterEmail})</span></td>}
                <td className="px-4 py-2 font-medium text-slate-800">{r.securityName ?? r.security_name}</td>
                <td className="px-4 py-2 text-slate-500">{r.transactionType ?? r.transaction_type}</td>
                <td className="px-4 py-2 text-slate-500">{r.quantity}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
                {isReviewer && (
                  <td className="px-4 py-2 text-right space-x-2">
                    {r.status === "PENDING" && (
                      <>
                        <button onClick={() => decide(r.id, "APPROVED")} className="text-xs text-emerald-700 hover:underline">Approve</button>
                        <button onClick={() => decide(r.id, "REJECTED")} className="text-xs text-red-600 hover:underline">Reject</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">No requests yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
    EXPIRED: "bg-slate-100 text-slate-500",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || "bg-slate-100"}`}>{status}</span>;
}
