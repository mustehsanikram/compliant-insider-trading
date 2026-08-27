import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can acknowledge declarations." }, { status: 403 });
  }
  const { id } = await params;
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE declarations SET acknowledged_by = ?, acknowledged_at = datetime('now') WHERE id = ? AND tenant_id = ? AND acknowledged_at IS NULL`
    )
    .run(session.id, id, session.tenantId);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found or already acknowledged." }, { status: 404 });
  }

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "DECLARATION_ACK", entity: "declarations", entityId: id });
  return NextResponse.json({ ok: true });
}
