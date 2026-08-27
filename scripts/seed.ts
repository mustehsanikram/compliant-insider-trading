import { getDb } from "../src/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function randomPassword(): string {
  // 16-char random password: readable-ish, strong enough for a demo credential handed off privately.
  return crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "!9";
}

async function main() {
  const db = getDb();

  const existing = db.prepare(`SELECT id FROM tenants WHERE id = ?`).get("demo");
  if (existing) {
    console.log("Demo tenant already seeded. Skipping. Delete data/app.db first to reseed with new passwords.");
    return;
  }

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

  console.log("\n=== Seeded demo tenant — credentials (shown once, not stored anywhere else) ===");
  for (const u of users) console.log(`  ${u.role.padEnd(20)} ${u.email} / ${u.pw}`);
  console.log("===============================================================================\n");
  console.log("Share these with your client privately (e.g. a password manager link or DM) — never post them publicly or leave them visible in the app UI.");
}

main();
