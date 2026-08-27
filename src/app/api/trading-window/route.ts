import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const history = db
    .prepare(
      `SELECT tw.id, tw.status, tw.reason, tw.starts_at as startsAt, tw.ends_at as endsAt, u.full_name as createdBy, tw.created_at as createdAt
       FROM trading_windows tw JOIN users u ON u.id = tw.created_by
       WHERE tw.tenant_id = ? ORDER BY tw.created_at DESC LIMIT 50`
    )
    .all(session.tenantId);

  const current = history[0] ?? null;

  return NextResponse.json({ current, history });
}

const schema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
  reason: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can change the trading window." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO trading_windows (id, tenant_id, status, reason, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, session.tenantId, parsed.data.status, parsed.data.reason ?? null, parsed.data.startsAt, parsed.data.endsAt ?? null, session.id);

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "TRADING_WINDOW_CHANGE", entity: "trading_windows", entityId: id, metadata: parsed.data });

  return NextResponse.json({ id }, { status: 201 });
}
