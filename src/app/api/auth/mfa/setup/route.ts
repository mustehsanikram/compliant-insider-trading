import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateTotpSecret, generateQrCodeDataUrl } from "@/lib/mfa";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  // Generate a new pending secret (not yet enabled) every time setup is (re)started.
  const secret = generateTotpSecret();
  db.prepare(`UPDATE users SET mfa_secret = ?, mfa_enabled = 0 WHERE id = ?`).run(secret, session.id);

  const qrDataUrl = await generateQrCodeDataUrl(secret, session.email);

  return NextResponse.json({ qrDataUrl, secret });
}
