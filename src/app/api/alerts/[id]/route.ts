import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["REVIEWED", "DISMISSED", "ESCALATED"]),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can review alerts." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const result = db
    .prepare(
      `UPDATE surveillance_alerts SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ? WHERE id = ? AND tenant_id = ?`
    )
    .run(parsed.data.status, session.id, parsed.data.note ?? null, id, session.tenantId);

  if (result.changes === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: `ALERT_${parsed.data.status}`, entity: "surveillance_alerts", entityId: id, metadata: parsed.data });
  return NextResponse.json({ ok: true });
}
