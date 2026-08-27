import { NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Auto-login: no credentials required. Creates (if needed) a default demo tenant and admin
 * user, then issues a real session cookie for it immediately. Login authentication has been
 * intentionally removed for this deployment — see README for why and how to restore it.
 */
export async function POST() {
  const db = getDb();

  let tenant = db.prepare(`SELECT id FROM tenants WHERE id = ?`).get("demo") as { id: string } | undefined;
  if (!tenant) {
    db.prepare(
      `INSERT INTO tenants (id, name, brand_name, primary_color, support_email) VALUES (?, ?, ?, ?, ?)`
    ).run("demo", "Demo Financial Services Ltd.", "Demo Compliance Portal", "#1d4ed8", "compliance@demo.example");
    tenant = { id: "demo" };
  }

  let user = db
    .prepare(`SELECT id, tenant_id as tenantId, email, full_name as fullName, role, designated_person as designatedPerson FROM users WHERE tenant_id = ? AND email = ?`)
    .get("demo", "mvp@gmail.com") as
    | { id: string; tenantId: string; email: string; fullName: string; role: "EMPLOYEE" | "COMPLIANCE_OFFICER" | "ADMIN"; designatedPerson: number }
    | undefined;

  if (!user) {
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10); // unused, login-by-password is bypassed entirely
    db.prepare(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, designated_person) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, "demo", "mvp@gmail.com", passwordHash, "MVP Admin", "ADMIN", 0);
    user = { id, tenantId: "demo", email: "mvp@gmail.com", fullName: "MVP Admin", role: "ADMIN", designatedPerson: 0 };
  }

  await setSessionCookie({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    designatedPerson: !!user.designatedPerson,
  });

  logAudit(db, { tenantId: user.tenantId, actorId: user.id, action: "AUTO_LOGIN", entity: "user", entityId: user.id });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    designatedPerson: !!user.designatedPerson,
  });
}
