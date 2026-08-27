import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit, runSurveillanceCheck } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Scheme trade records are restricted to compliance officers and admins." }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT st.id, st.scheme_name as schemeName, st.security_name as securityName, st.isin, st.transaction_type as transactionType,
              st.quantity, st.trade_date as tradeDate, st.created_at as createdAt, u.full_name as loggedBy
       FROM scheme_trades st JOIN users u ON u.id = st.logged_by
       WHERE st.tenant_id = ? ORDER BY st.trade_date DESC`
    )
    .all(session.tenantId);
  return NextResponse.json({ items: rows });
}

const schema = z.object({
  schemeName: z.string().min(1),
  securityName: z.string().min(1),
  isin: z.string().optional(),
  transactionType: z.enum(["BUY", "SELL"]),
  quantity: z.number().int().positive(),
  tradeDate: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can log scheme trades." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO scheme_trades (id, tenant_id, scheme_name, security_name, isin, transaction_type, quantity, trade_date, logged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, session.tenantId, parsed.data.schemeName, parsed.data.securityName, parsed.data.isin ?? null, parsed.data.transactionType, parsed.data.quantity, parsed.data.tradeDate, session.id);

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "SCHEME_TRADE_LOG", entity: "scheme_trades", entityId: id, metadata: parsed.data });

  // Newly logged scheme trade might match trades employees already made/requested — check both sources.
  const preclearances = db
    .prepare(
      `SELECT id, user_id as userId, requested_at as requestedAt FROM preclearance_requests
       WHERE tenant_id = ? AND status = 'APPROVED' AND (security_name = ? OR (isin IS NOT NULL AND isin = ?))`
    )
    .all(session.tenantId, parsed.data.securityName, parsed.data.isin ?? "") as { id: string; userId: string; requestedAt: string }[];

  for (const pc of preclearances) {
    runSurveillanceCheck(db, {
      tenantId: session.tenantId,
      securityName: parsed.data.securityName,
      isin: parsed.data.isin,
      employeeUserId: pc.userId,
      employeeTradeDate: pc.requestedAt,
      source: "PRECLEARANCE",
      sourceId: pc.id,
    });
  }

  return NextResponse.json({ id }, { status: 201 });
}
