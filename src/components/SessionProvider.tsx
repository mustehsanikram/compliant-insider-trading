"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "EMPLOYEE" | "COMPLIANCE_OFFICER" | "ADMIN";
  designatedPerson: boolean;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiFetch<{ user: SessionUser | null; tenant: Tenant | null }>("/api/auth/me");
      setUser(data.user);
      setTenant(data.tenant);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && !user && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return <SessionContext.Provider value={{ user, tenant, loading, refresh }}>{children}</SessionContext.Provider>;
}
