"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Overview", roles: ["EMPLOYEE", "COMPLIANCE_OFFICER", "ADMIN"] },
  { href: "/restricted-list", label: "Restricted List", roles: ["EMPLOYEE", "COMPLIANCE_OFFICER", "ADMIN"] },
  { href: "/preclearance", label: "Pre-Clearance", roles: ["EMPLOYEE", "COMPLIANCE_OFFICER", "ADMIN"] },
  { href: "/declarations", label: "Declarations", roles: ["EMPLOYEE", "COMPLIANCE_OFFICER", "ADMIN"] },
  { href: "/upsi", label: "UPSI Register", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { href: "/admin", label: "Branding / Admin", roles: ["ADMIN"] },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, tenant, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }
  if (!user) return null; // redirect handled in SessionProvider

  const primaryColor = tenant?.primaryColor || "#1d4ed8";

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ ["--brand" as string]: primaryColor }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded" style={{ backgroundColor: primaryColor }} />
            <span className="font-semibold text-slate-900 text-sm">{tenant?.brandName || "Compliance Portal"}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              {user.fullName} · <span className="uppercase tracking-wide">{user.role.replace("_", " ")}</span>
              {user.designatedPerson ? " · Designated Person" : ""}
            </span>
            <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex gap-6 px-6 py-6">
        <nav className="w-52 shrink-0 space-y-1">
          {NAV.filter((item) => item.roles.includes(user.role)).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active ? "text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                style={active ? { backgroundColor: primaryColor } : {}}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
