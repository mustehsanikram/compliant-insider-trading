"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Alert {
  id: string;
  securityName: string;
  employeeSource: string;
  daysBetween: number;
  status: string;
  createdAt: string;
  reviewNote?: string;
  employeeName: string;
  employeeEmail: string;
  schemeName: string;
  schemeTransactionType: string;
  schemeTradeDate: string;
  schemeQuantity: number;
}

export default function AlertsPage() {
  const [items, setItems] = useState<Alert[]>([]);

  async function load() {
    const data = await apiFetch<{ items: Alert[] }>("/api/alerts");
    setItems(data.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, status: "REVIEWED" | "DISMISSED" | "ESCALATED") {
    await apiFetch(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  const open = items.filter((i) => i.status === "OPEN");
  const closed = items.filter((i) => i.status !== "OPEN");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Surveillance Alerts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Auto-generated whenever an employee's approved trade falls within 7 days of a scheme trade in the same security — the core signature SEBI's front-running surveillance expects AMCs to monitor.
        </p>
      </div>

      <Section title={`Open (${open.length})`} items={open} onReview={review} />
      {closed.length > 0 && <Section title={`Reviewed (${closed.length})`} items={closed} onReview={review} readOnly />}
    </div>
  );
}

function Section({ title, items, onReview, readOnly }: { title: string; items: Alert[]; onReview: (id: string, s: "REVIEWED" | "DISMISSED" | "ESCALATED") => void; readOnly?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Employee</th>
              <th className="text-left px-4 py-2">Security</th>
              <th className="text-left px-4 py-2">Scheme trade</th>
              <th className="text-left px-4 py-2">Gap</th>
              <th className="text-left px-4 py-2">Status</th>
              {!readOnly && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700">
                  {a.employeeName} <span className="text-slate-400">({a.employeeEmail})</span>
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">{a.securityName}</td>
                <td className="px-4 py-2 text-slate-500">
                  {a.schemeName}: {a.schemeTransactionType} {a.schemeQuantity} on {a.schemeTradeDate}
                </td>
                <td className="px-4 py-2 text-slate-500">{a.daysBetween}d</td>
                <td className="px-4 py-2">
                  <StatusBadge status={a.status} />
                </td>
                {!readOnly && (
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => onReview(a.id, "DISMISSED")} className="text-xs text-slate-500 hover:underline">Dismiss</button>
                    <button onClick={() => onReview(a.id, "REVIEWED")} className="text-xs text-emerald-700 hover:underline">Mark reviewed</button>
                    <button onClick={() => onReview(a.id, "ESCALATED")} className="text-xs text-red-600 hover:underline">Escalate</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">Nothing here.</td>
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
    OPEN: "bg-amber-50 text-amber-700",
    REVIEWED: "bg-emerald-50 text-emerald-700",
    DISMISSED: "bg-slate-100 text-slate-500",
    ESCALATED: "bg-red-50 text-red-700",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || "bg-slate-100"}`}>{status}</span>;
}
