import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const isReviewer = session.role === "COMPLIANCE_OFFICER" || session.role === "ADMIN";

  const rows = isReviewer
    ? db
        .prepare(
          `SELECT pr.*, u.full_name as requesterName, u.email as requesterEmail
           FROM preclearance_requests pr JOIN users u ON u.id = pr.user_id
           WHERE pr.tenant_id = ? ORDER BY pr.requested_at DESC`
        )
        .all(session.tenantId)
    : db
        .prepare(`SELECT * FROM preclearance_requests WHERE tenant_id = ? AND user_id = ? ORDER BY requested_at DESC`)
        .all(session.tenantId, session.id);

  return NextResponse.json({ items: rows });
}

const schema = z.object({
  securityName: z.string().min(1),
  isin: z.string().optional(),
  transactionType: z.enum(["BUY", "SELL"]),
  quantity: z.number().int().positive(),
  estimatedValue: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();

  // Block automatically if the security is currently on the restricted list
  const restricted = db
    .prepare(
      `SELECT id FROM restricted_list WHERE tenant_id = ? AND removed_at IS NULL AND (security_name = ? OR (isin IS NOT NULL AND isin = ?))`
    )
    .get(session.tenantId, parsed.data.securityName, parsed.data.isin ?? "");

  // Block automatically if the trading window is currently closed
  const latestWindow = db
    .prepare(`SELECT status FROM trading_windows WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(session.tenantId) as { status: string } | undefined;

  if (restricted) {
    return NextResponse.json(
      { error: `"${parsed.data.securityName}" is currently on the restricted list. Pre-clearance cannot be requested.` },
      { status: 409 }
    );
  }
  if (latestWindow?.status === "CLOSED") {
    return NextResponse.json(
      { error: "The trading window is currently closed. Pre-clearance requests cannot be submitted." },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO preclearance_requests (id, tenant_id, user_id, security_name, isin, transaction_type, quantity, estimated_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    session.tenantId,
    session.id,
    parsed.data.securityName,
    parsed.data.isin ?? null,
    parsed.data.transactionType,
    parsed.data.quantity,
    parsed.data.estimatedValue ?? null
  );

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "PRECLEARANCE_REQUEST", entity: "preclearance_requests", entityId: id, metadata: parsed.data });

  return NextResponse.json({ id }, { status: 201 });
}
