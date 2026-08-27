import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getMfaPendingUserId, clearMfaPendingCookie, setSessionCookie } from "@/lib/auth";
import { verifyTotpCode } from "@/lib/mfa";
import { isRateLimited } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({ code: z.string().min(6).max(6) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`mfa-challenge:${ip}`)) {
    return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const userId = await getMfaPendingUserId();
  if (!userId) {
    return NextResponse.json({ error: "No pending login. Please sign in again." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });

  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, tenant_id as tenantId, email, full_name as fullName, role, designated_person as designatedPerson, mfa_secret as mfaSecret
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | { id: string; tenantId: string; email: string; fullName: string; role: "EMPLOYEE" | "COMPLIANCE_OFFICER" | "ADMIN"; designatedPerson: number; mfaSecret: string | null }
    | undefined;

  if (!user || !user.mfaSecret) {
    return NextResponse.json({ error: "MFA not set up for this account." }, { status: 400 });
  }

  const valid = verifyTotpCode(user.mfaSecret, user.email, parsed.data.code);
  if (!valid) {
    logAudit(db, { tenantId: user.tenantId, actorId: user.id, action: "MFA_CHALLENGE_FAILED", entity: "user", entityId: user.id });
    return NextResponse.json({ error: "Invalid code." }, { status: 401 });
  }

  await clearMfaPendingCookie();
  await setSessionCookie({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    designatedPerson: !!user.designatedPerson,
  });

  logAudit(db, { tenantId: user.tenantId, actorId: user.id, action: "LOGIN_MFA_SUCCESS", entity: "user", entityId: user.id });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    designatedPerson: !!user.designatedPerson,
  });
}
