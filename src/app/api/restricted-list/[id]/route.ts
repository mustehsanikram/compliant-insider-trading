import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can modify the restricted list." }, { status: 403 });
  }
  const { id } = await params;
  const db = getDb();
  const result = db
    .prepare(`UPDATE restricted_list SET removed_at = datetime('now') WHERE id = ? AND tenant_id = ? AND removed_at IS NULL`)
    .run(id, session.tenantId);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found or already removed." }, { status: 404 });
  }

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "RESTRICTED_LIST_REMOVE", entity: "restricted_list", entityId: id });
  return NextResponse.json({ ok: true });
}
