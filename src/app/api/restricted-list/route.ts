import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT rl.id, rl.security_name as securityName, rl.isin, rl.reason, rl.added_at as addedAt, rl.removed_at as removedAt,
              u.full_name as addedBy
       FROM restricted_list rl JOIN users u ON u.id = rl.added_by
       WHERE rl.tenant_id = ?
       ORDER BY rl.added_at DESC`
    )
    .all(session.tenantId);

  return NextResponse.json({ items: rows });
}

const addSchema = z.object({
  securityName: z.string().min(1),
  isin: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can modify the restricted list." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO restricted_list (id, tenant_id, security_name, isin, reason, added_by) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, session.tenantId, parsed.data.securityName, parsed.data.isin ?? null, parsed.data.reason ?? null, session.id);

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "RESTRICTED_LIST_ADD", entity: "restricted_list", entityId: id, metadata: parsed.data });

  return NextResponse.json({ id }, { status: 201 });
}
