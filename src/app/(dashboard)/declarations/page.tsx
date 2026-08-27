"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/api";

interface Declaration {
  id: string;
  declaration_type?: string;
  declarationType?: string;
  details_json?: string;
  detailsJson?: string;
  submitted_at?: string;
  submittedAt?: string;
  acknowledged_at?: string;
  acknowledgedAt?: string;
  employeeName?: string;
  employeeEmail?: string;
}

const TYPES = [
  { value: "INITIAL_HOLDING", label: "Initial Holding Disclosure" },
  { value: "ANNUAL_HOLDING", label: "Annual Holding Disclosure" },
  { value: "TRANSACTION", label: "Transaction Disclosure" },
  { value: "RELATIVE_UPDATE", label: "Immediate Relative Update" },
];

export default function DeclarationsPage() {
  const { user } = useSession();
  const isReviewer = user?.role === "COMPLIANCE_OFFICER" || user?.role === "ADMIN";
  const [items, setItems] = useState<Declaration[]>([]);
  const [type, setType] = useState(TYPES[0].value);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ items: Declaration[] }>("/api/declarations");
    setItems(data.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/declarations", {
        method: "POST",
        body: JSON.stringify({ declarationType: type, details: { note: details } }),
      });
      setDetails("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  async function acknowledge(id: string) {
    await apiFetch(`/api/declarations/${id}`, { method: "PATCH" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Declarations</h1>

      {!isReviewer && (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Declaration type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full sm:w-72 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Details</label>
            <textarea required value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="e.g. Holdings as of today: 200 shares of XYZ Ltd." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="rounded-md text-white text-sm font-medium py-1.5 px-4" style={{ backgroundColor: "var(--brand, #1d4ed8)" }}>
            Submit declaration
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              {isReviewer && <th className="text-left px-4 py-2">Employee</th>}
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Details</th>
              <th className="text-left px-4 py-2">Submitted</th>
              <th className="text-left px-4 py-2">Status</th>
              {isReviewer && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((d) => {
              let note = "—";
              try {
                note = JSON.parse(d.details_json ?? d.detailsJson ?? "{}").note || "—";
              } catch {}
              const ack = d.acknowledged_at ?? d.acknowledgedAt;
              return (
                <tr key={d.id} className="border-t border-slate-100">
                  {isReviewer && <td className="px-4 py-2 text-slate-600">{d.employeeName}</td>}
                  <td className="px-4 py-2 text-slate-700">{(d.declarationType ?? d.declaration_type)?.replaceAll("_", " ")}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-xs truncate">{note}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(d.submittedAt ?? d.submitted_at ?? "").toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {ack ? <span className="text-xs text-emerald-700">Acknowledged</span> : <span className="text-xs text-amber-700">Pending review</span>}
                  </td>
                  {isReviewer && (
                    <td className="px-4 py-2 text-right">
                      {!ack && <button onClick={() => acknowledge(d.id)} className="text-xs text-slate-500 hover:text-emerald-700">Acknowledge</button>}
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">No declarations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
