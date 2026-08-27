"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "@/lib/api";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "EMPLOYEE" | "COMPLIANCE_OFFICER" | "ADMIN";
  designatedPerson: boolean;
  mfaEnabled?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  brandName: string;
  primaryColor: string;
  logoUrl?: string | null;
}

interface SessionContextValue {
  user: SessionUser | null;
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({ user: null, tenant: null, loading: true, refresh: async () => {} });

export function useSession() {
  return useContext(SessionContext);
}

// NOTE: login authentication has been intentionally removed for this deployment.
// Any visitor is automatically signed in as a default Admin account — see README.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiFetch<{ user: SessionUser | null; tenant: Tenant | null }>("/api/auth/me");
      if (!data.user) {
        // No session yet — auto-login instead of redirecting to a login form.
        await apiFetch("/api/auth/auto", { method: "POST" });
        const retry = await apiFetch<{ user: SessionUser | null; tenant: Tenant | null }>("/api/auth/me");
        setUser(retry.user);
        setTenant(retry.tenant);
      } else {
        setUser(data.user);
        setTenant(data.tenant);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SessionContext.Provider value={{ user, tenant, loading, refresh }}>{children}</SessionContext.Provider>;
}
