import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyTotpCode } from "@/lib/mfa";
import { z } from "zod";

const enableSchema = z.object({ action: z.literal("enable"), code: z.string().min(6).max(6) });
const disableSchema = z.object({ action: z.literal("disable") });
const schema = z.discriminatedUnion("action", [enableSchema, disableSchema]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();

  if (parsed.data.action === "disable") {
    db.prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?`).run(session.id);
    logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "MFA_DISABLED", entity: "user", entityId: session.id });
    return NextResponse.json({ ok: true, mfaEnabled: false });
  }

  const row = db.prepare(`SELECT mfa_secret as mfaSecret FROM users WHERE id = ?`).get(session.id) as { mfaSecret: string | null } | undefined;
  if (!row?.mfaSecret) {
    return NextResponse.json({ error: "Start MFA setup first to get a QR code." }, { status: 400 });
  }

  const valid = verifyTotpCode(row.mfaSecret, session.email, parsed.data.code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code. Check your authenticator app and try again." }, { status: 400 });
  }

  db.prepare(`UPDATE users SET mfa_enabled = 1 WHERE id = ?`).run(session.id);
  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "MFA_ENABLED", entity: "user", entityId: session.id });

  return NextResponse.json({ ok: true, mfaEnabled: true });
}
