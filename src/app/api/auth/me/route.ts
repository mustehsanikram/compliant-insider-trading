import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  const db = getDb();
  const tenant = db
    .prepare(`SELECT id, name, brand_name as brandName, primary_color as primaryColor, logo_url as logoUrl FROM tenants WHERE id = ?`)
    .get(session.tenantId);

  const row = db.prepare(`SELECT mfa_enabled as mfaEnabled FROM users WHERE id = ?`).get(session.id) as { mfaEnabled: number } | undefined;

  return NextResponse.json({ user: { ...session, mfaEnabled: !!row?.mfaEnabled }, tenant });
}
