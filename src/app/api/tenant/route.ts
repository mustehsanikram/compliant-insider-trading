import { NextRequest, NextResponse } from "next/server";
import { getDb, logAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const tenant = db
    .prepare(
      `SELECT id, name, brand_name as brandName, primary_color as primaryColor, logo_url as logoUrl, support_email as supportEmail
       FROM tenants WHERE id = ?`
    )
    .get(session.tenantId);
  return NextResponse.json({ tenant });
}

const schema = z.object({
  brandName: z.string().min(1).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  supportEmail: z.string().email().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["ADMIN"])) {
    return NextResponse.json({ error: "Only admins can change white-label branding." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.brandName !== undefined) { fields.push("brand_name = ?"); values.push(parsed.data.brandName); }
  if (parsed.data.primaryColor !== undefined) { fields.push("primary_color = ?"); values.push(parsed.data.primaryColor); }
  if (parsed.data.logoUrl !== undefined) { fields.push("logo_url = ?"); values.push(parsed.data.logoUrl || null); }
  if (parsed.data.supportEmail !== undefined) { fields.push("support_email = ?"); values.push(parsed.data.supportEmail); }

  if (fields.length === 0) return NextResponse.json({ error: "No fields to update." }, { status: 400 });

  values.push(session.tenantId);
  db.prepare(`UPDATE tenants SET ${fields.join(", ")} WHERE id = ?`).run(...(values as []));

  logAudit(db, { tenantId: session.tenantId, actorId: session.id, action: "TENANT_BRANDING_UPDATE", entity: "tenants", entityId: session.tenantId, metadata: parsed.data });

  return NextResponse.json({ ok: true });
}
