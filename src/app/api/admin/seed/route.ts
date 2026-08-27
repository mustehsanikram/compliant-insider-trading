import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function randomPassword(): string {
  return crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "!9";
}

/**
 * One-time seeding endpoint, protected by a shared secret so it can't be triggered by anyone
 * who doesn't have it. Exists specifically because some hosts (e.g. Railway's "Console"/"Run
 * Command" feature) execute one-off commands in an isolated instance whose local filesystem is
 * NOT the same as the instance actually serving HTTP traffic — so a CLI-run seed script can
 * silently write to a database the live app never reads from. Hitting this via HTTP guarantees
 * the code runs inside the exact process instance serving requests.
 *
 * Usage: POST /api/admin/seed?token=<ADMIN_SEED_TOKEN>
 * Set ADMIN_SEED_TOKEN as an environment variable before calling this — if it's not set, the
 * endpoint refuses to run at all, so it can never be triggered accidentally or by a stranger.
 */
export async function POST(req: NextRequest) {
  const expectedToken = process.env.ADMIN_SEED_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "ADMIN_SEED_TOKEN is not set on this deployment. Set it as an environment variable first." }, { status: 503 });
  }

  const providedToken = req.nextUrl.searchParams.get("token");
  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Invalid or missing token." }, { status: 401 });
  }

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM tenants WHERE id = ?`).get("demo");

  if (!existing) {
    db.prepare(
      `INSERT INTO tenants (id, name, brand_name, primary_color, support_email) VALUES (?, ?, ?, ?, ?)`
    ).run("demo", "Demo Financial Services Ltd.", "Demo Compliance Portal", "#1d4ed8", "compliance@demo.example");

    const users = [
      { email: "mvp@gmail.com", name: "MVP Admin", role: "ADMIN", pw: "demo@1234!", designated: 0 },
      { email: "admin@demo.example", name: "Aisha Khan", role: "ADMIN", pw: randomPassword(), designated: 0 },
      { email: "compliance@demo.example", name: "Ravi Mehta", role: "COMPLIANCE_OFFICER", pw: randomPassword(), designated: 0 },
      { email: "employee@demo.example", name: "Sara Ahmed", role: "EMPLOYEE", pw: randomPassword(), designated: 1 },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.pw, 10);
      db.prepare(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, designated_person) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), "demo", u.email, hash, u.name, u.role, u.designated);
    }

    return NextResponse.json({
      message: "Seeded successfully on the live instance.",
      accounts: users.map((u) => ({ role: u.role, email: u.email, password: u.pw })),
    });
  }

  // Tenant already exists (e.g. from an earlier partial seed or the now-removed auto-login
  // flow). Always ensure mvp@gmail.com specifically has the correct known password, since an
  // earlier auto-login run could have created it with an unusable random hash.
  const mvpHash = await bcrypt.hash("demo@1234!", 10);
  const mvpUser = db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND email = ?`).get("demo", "mvp@gmail.com") as { id: string } | undefined;

  if (mvpUser) {
    db.prepare(`UPDATE users SET password_hash = ?, role = 'ADMIN' WHERE id = ?`).run(mvpHash, mvpUser.id);
  } else {
    db.prepare(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, designated_person) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), "demo", "mvp@gmail.com", mvpHash, "MVP Admin", "ADMIN", 0);
  }

  return NextResponse.json({
    message: "Tenant already existed. Ensured mvp@gmail.com exists with the correct password.",
    accounts: [{ role: "ADMIN", email: "mvp@gmail.com", password: "demo@1234!" }],
  });
}
