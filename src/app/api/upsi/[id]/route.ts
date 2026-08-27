import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

const accessSchema = z.object({
  action: z.literal("access"),
  userId: z.string(),
  accessType: z.enum(["GRANTED", "REVOKED"]),
  note: z.string().optional(),
});

const publishSchema = z.object({
  action: z.literal("mark_public"),
});

const schema = z.discriminatedUnion("action", [accessSchema, publishSchema]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can modify UPSI records." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();

  if (parsed.data.action === "access") {
    const logId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO upsi_access_log (id, upsi_entry_id, user_id, access_type, note) VALUES (?, ?, ?, ?, ?)`
    ).run(logId, id, parsed.data.userId, parsed.data.accessType, parsed.data.note ?? null);

    logAudit(db, {
      tenantId: session.tenantId,
      actorId: session.id,
      action: `UPSI_ACCESS_${parsed.data.accessType}`,
      entity: "upsi_entries",
      entityId: id,
      metadata: { grantedTo: parsed.data.userId },
    });
    return NextResponse.json({ ok: true });
  }

  // mark_public: record when UPSI ceases to be price-sensitive (becomes public)
  const result = db
    .prepare(`UPDATE upsi_entries SET made_public_at = datetime('now') WHERE id = ? AND tenant_id = ? AND made_public_at IS NULL`)
    .run(id, session.tenantId);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found or already marked public." }, { status: 404 });
  }

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "UPSI_MARKED_PUBLIC", entity: "upsi_entries", entityId: id });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const db = getDb();
  const log = db
    .prepare(
      `SELECT l.id, l.access_type as accessType, l.at, l.note, u.full_name as userName, u.email as userEmail
       FROM upsi_access_log l JOIN users u ON u.id = l.user_id
       WHERE l.upsi_entry_id = ? ORDER BY l.at DESC`
    )
    .all(id);
  return NextResponse.json({ items: log });
}
