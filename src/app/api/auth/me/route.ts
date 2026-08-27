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

  return NextResponse.json({ user: session, tenant });
}
