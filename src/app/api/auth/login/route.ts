import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, tenant_id as tenantId, email, password_hash as passwordHash, full_name as fullName, role, designated_person as designatedPerson
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
      }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
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
