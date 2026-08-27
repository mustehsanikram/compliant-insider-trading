import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "UPSI records are restricted to compliance officers and admins." }, { status: 403 });
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.id, e.subject, e.description, e.created_at as createdAt, e.made_public_at as madePublicAt, e.content_hash as contentHash,
              u.full_name as createdBy
       FROM upsi_entries e JOIN users u ON u.id = e.created_by
       WHERE e.tenant_id = ? ORDER BY e.created_at DESC`
    )
    .all(session.tenantId);

  // Log that this compliance officer viewed the UPSI register (access logging is itself a PIT requirement)
  logAudit(db, { tenantId: session!.tenantId, actorId: session!.id, action: "UPSI_REGISTER_VIEW", entity: "upsi_entries" });

  return NextResponse.json({ items: rows });
}

const schema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Only compliance officers or admins can log UPSI." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const contentHash = crypto
    .createHash("sha256")
    .update(`${parsed.data.subject}|${parsed.data.description}|${createdAt}`)
    .digest("hex");

  db.prepare(
    `INSERT INTO upsi_entries (id, tenant_id, subject, description, created_by, created_at, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, session.tenantId, parsed.data.subject, parsed.data.description, session.id, createdAt, contentHash);

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "UPSI_CREATE", entity: "upsi_entries", entityId: id, metadata: { subject: parsed.data.subject } });

  return NextResponse.json({ id, contentHash }, { status: 201 });
}
