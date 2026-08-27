import { getDb } from "../src/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function main() {
  const db = getDb();

  const existing = db.prepare(`SELECT id FROM tenants WHERE id = ?`).get("demo");
  if (existing) {
    console.log("Demo tenant already seeded. Skipping.");
    return;
  }

  db.prepare(
    `INSERT INTO tenants (id, name, brand_name, primary_color, support_email) VALUES (?, ?, ?, ?, ?)`
  ).run("demo", "Demo Financial Services Ltd.", "Demo Compliance Portal", "#1d4ed8", "compliance@demo.example");

  const users = [
    { email: "admin@demo.example", name: "Aisha Khan", role: "ADMIN", pw: "Admin@12345", designated: 0 },
    { email: "compliance@demo.example", name: "Ravi Mehta", role: "COMPLIANCE_OFFICER", pw: "Compliance@12345", designated: 0 },
    { email: "employee@demo.example", name: "Sara Ahmed", role: "EMPLOYEE", pw: "Employee@12345", designated: 1 },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.pw, 10);
    db.prepare(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, designated_person) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), "demo", u.email, hash, u.name, u.role, u.designated);
  }

  console.log("Seeded demo tenant with 3 users:");
  for (const u of users) console.log(`  ${u.role.padEnd(20)} ${u.email} / ${u.pw}`);
}

main();
