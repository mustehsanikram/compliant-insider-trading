import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { verifyPassword, setSessionCookie, setMfaPendingCookie } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`login:${ip}`)) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, tenant_id as tenantId, email, password_hash as passwordHash, full_name as fullName, role, designated_person as designatedPerson,
              mfa_enabled as mfaEnabled
       FROM users WHERE email = ?`
    )
    .get(email) as
    | {
        id: string;
        tenantId: string;
        email: string;
        passwordHash: string;
        fullName: string;
        role: "EMPLOYEE" | "COMPLIANCE_OFFICER" | "ADMIN";
        designatedPerson: number;
        mfaEnabled: number;
      }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (user.mfaEnabled) {
    // Password correct, but a second factor is required before a real session is issued.
    await setMfaPendingCookie(user.id);
    logAudit(db, { tenantId: user.tenantId, actorId: user.id, action: "LOGIN_PASSWORD_OK_MFA_PENDING", entity: "user", entityId: user.id });
    return NextResponse.json({ mfaRequired: true });
  }

  await setSessionCookie({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    designatedPerson: !!user.designatedPerson,
  });

  logAudit(db, { tenantId: user.tenantId, actorId: user.id, action: "LOGIN", entity: "user", entityId: user.id });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    designatedPerson: !!user.designatedPerson,
  });
}
