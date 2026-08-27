"use client";

import { useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/api";

export default function SecurityPage() {
  const { user, refresh } = useSession();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ qrDataUrl: string; secret: string }>("/api/auth/mfa/setup", { method: "POST" });
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/mfa/enable", { method: "POST", body: JSON.stringify({ action: "enable", code }) });
      setSuccess("Two-factor authentication is now enabled on your account.");
      setQrDataUrl(null);
      setSecret(null);
      setCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setError(null);
    setSuccess(null);
    if (!confirm("Disable two-factor authentication on your account?")) return;
    setLoading(true);
    try {
      await apiFetch("/api/auth/mfa/enable", { method: "POST", body: JSON.stringify({ action: "disable" }) });
      setSuccess("Two-factor authentication has been disabled.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Security</h1>
        <p className="text-sm text-slate-500 mt-1">Two-factor authentication (TOTP) adds a second step to sign-in using an authenticator app like Google Authenticator or Authy.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Status</span>
          {user?.mfaEnabled ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Enabled</span>
          ) : (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not enabled</span>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}

        {user?.mfaEnabled ? (
          <button onClick={disable} disabled={loading} className="text-sm text-red-600 hover:underline disabled:opacity-60">
            Disable two-factor authentication
          </button>
        ) : qrDataUrl ? (
          <form onSubmit={confirmEnable} className="space-y-3">
            <p className="text-sm text-slate-600">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="MFA QR code" className="border border-slate-200 rounded-md" width={200} height={200} />
            {secret && (
              <p className="text-xs text-slate-400 font-mono break-all">Can't scan? Enter manually: {secret}</p>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="block rounded-md text-white text-sm font-medium py-1.5 px-4"
              style={{ backgroundColor: "var(--brand, #1d4ed8)" }}
            >
              Confirm and enable
            </button>
          </form>
        ) : (
          <button
            onClick={startSetup}
            disabled={loading}
            className="rounded-md text-white text-sm font-medium py-1.5 px-4 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand, #1d4ed8)" }}
          >
            Set up two-factor authentication
          </button>
        )}
      </div>
    </div>
  );
}
