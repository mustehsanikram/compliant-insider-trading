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
          `SELECT d.id, d.declaration_type as declarationType, d.details_json as detailsJson, d.submitted_at as submittedAt,
                  d.acknowledged_at as acknowledgedAt, u.full_name as employeeName, u.email as employeeEmail
           FROM declarations d JOIN users u ON u.id = d.user_id
           WHERE d.tenant_id = ? ORDER BY d.submitted_at DESC`
        )
        .all(session.tenantId)
    : db
        .prepare(`SELECT * FROM declarations WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at DESC`)
        .all(session.tenantId, session.id);

  return NextResponse.json({ items: rows });
}

const schema = z.object({
  declarationType: z.enum(["INITIAL_HOLDING", "ANNUAL_HOLDING", "TRANSACTION", "RELATIVE_UPDATE"]),
  details: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO declarations (id, tenant_id, user_id, declaration_type, details_json) VALUES (?, ?, ?, ?, ?)`
  ).run(id, session.tenantId, session.id, parsed.data.declarationType, JSON.stringify(parsed.data.details));

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "DECLARATION_SUBMIT", entity: "declarations", entityId: id, metadata: { declarationType: parsed.data.declarationType } });

  return NextResponse.json({ id }, { status: 201 });
}
