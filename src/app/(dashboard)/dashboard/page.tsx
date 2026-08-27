"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/api";

interface TradingWindow {
  status: "OPEN" | "CLOSED";
  reason?: string;
  startsAt: string;
  endsAt?: string;
}

export default function OverviewPage() {
  const { user } = useSession();
  const [window, setWindow] = useState<TradingWindow | null>(null);
  const [restrictedCount, setRestrictedCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ current: TradingWindow | null }>("/api/trading-window").then((d) => setWindow(d.current));
    apiFetch<{ items: unknown[] }>("/api/restricted-list").then((d) => setRestrictedCount(d.items.length));
    apiFetch<{ items: { status: string }[] }>("/api/preclearance").then((d) =>
      setPendingCount(d.items.filter((i) => i.status === "PENDING").length)
    );
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Welcome, {user?.fullName}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title="Trading Window" value={window ? window.status : "—"} tone={window?.status === "CLOSED" ? "red" : "green"} />
        <Card title="Securities on Restricted List" value={restrictedCount ?? "—"} tone="slate" />
        <Card title="Pending Pre-Clearance Requests" value={pendingCount ?? "—"} tone="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Quick guide</h2>
        <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
          <li>Employees: submit pre-clearance requests and periodic holding declarations.</li>
          <li>Compliance officers: manage the restricted list, trading window, pre-clearance decisions, UPSI register, and declaration acknowledgements.</li>
          <li>Admins: additionally manage white-label branding for this deployment.</li>
        </ul>
      </div>
    </div>
  );
}

function Card({ title, value, tone }: { title: string; value: string | number; tone: "green" | "red" | "amber" | "slate" }) {
  const toneClasses: Record<string, string> = {
    green: "text-emerald-700 bg-emerald-50 border-emerald-200",
    red: "text-red-700 bg-red-50 border-red-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    slate: "text-slate-700 bg-slate-50 border-slate-200",
  };
  return (
    <div className={`rounded-xl border p-5 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{title}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
