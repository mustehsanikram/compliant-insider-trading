import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
  validDays: z.number().int().positive().default(7),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can decide pre-clearance requests." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const validUntil =
    parsed.data.decision === "APPROVED"
      ? new Date(Date.now() + parsed.data.validDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const result = db
    .prepare(
      `UPDATE preclearance_requests
       SET status = ?, decided_by = ?, decided_at = datetime('now'), decision_note = ?, valid_until = ?, contra_trade_checked = 1
       WHERE id = ? AND tenant_id = ? AND status = 'PENDING'`
    )
    .run(parsed.data.decision, session.id, parsed.data.note ?? null, validUntil, id, session.tenantId);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Request not found or already decided." }, { status: 404 });
  }

  logAudit(db, {
    tenantId: session.tenantId,
    actorId: session.id,
    action: `PRECLEARANCE_${parsed.data.decision}`,
    entity: "preclearance_requests",
    entityId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
