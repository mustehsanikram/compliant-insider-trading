import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "app.db");

// Ensure data directory exists (works both locally and in most container hosts;
// for production, mount a persistent volume at this path or swap this module
// for a Postgres client — see README "Production database" section).
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    -- One row per client deployment/brand (white-labeling)
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      primary_color TEXT NOT NULL DEFAULT '#0f172a',
      logo_url TEXT,
      support_email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('EMPLOYEE','COMPLIANCE_OFFICER','ADMIN')),
      employee_code TEXT,
      designated_person INTEGER NOT NULL DEFAULT 0, -- 1 if classified as a "Designated Person" under PIT rules
      mfa_secret TEXT,               -- base32 TOTP secret; set once user starts MFA setup
      mfa_enabled INTEGER NOT NULL DEFAULT 0, -- 1 once user has confirmed a code and MFA is enforced
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, email)
    );

    -- Restricted List: securities/entities under trading restriction for a tenant
    CREATE TABLE IF NOT EXISTS restricted_list (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      security_name TEXT NOT NULL,
      isin TEXT,
      reason TEXT,
      added_by TEXT NOT NULL REFERENCES users(id),
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      removed_at TEXT
    );

    -- Trading Window: open/closed periods, tenant-wide or scoped to a security
    CREATE TABLE IF NOT EXISTS trading_windows (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED')),
      reason TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Pre-clearance requests for trades by designated persons
    CREATE TABLE IF NOT EXISTS preclearance_requests (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      security_name TEXT NOT NULL,
      isin TEXT,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('BUY','SELL')),
      quantity INTEGER NOT NULL,
      estimated_value REAL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_by TEXT REFERENCES users(id),
      decided_at TEXT,
      decision_note TEXT,
      valid_until TEXT,           -- approvals typically expire (e.g. 7 trading days)
      contra_trade_checked INTEGER NOT NULL DEFAULT 0
    );

    -- UPSI (Unpublished Price Sensitive Information) log — the "Structured Digital Database" (SDD)
    -- SEBI PIT requires an immutable, time-stamped, internally-secured record of UPSI access.
    CREATE TABLE IF NOT EXISTS upsi_entries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      subject TEXT NOT NULL,             -- what the UPSI concerns (e.g. "Q2 earnings", "Merger X")
      description TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      made_public_at TEXT,               -- null while still unpublished/price-sensitive
      -- entries are append-only at the application layer: no UPDATE/DELETE routes are exposed
      content_hash TEXT NOT NULL         -- sha256 of subject+description+created_at, for tamper-evidence
    );

    CREATE TABLE IF NOT EXISTS upsi_access_log (
      id TEXT PRIMARY KEY,
      upsi_entry_id TEXT NOT NULL REFERENCES upsi_entries(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      access_type TEXT NOT NULL CHECK(access_type IN ('GRANTED','VIEWED','REVOKED')),
      at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT
    );

    -- Employee self-declarations (holdings, immediate relatives, annual/periodic disclosures)
    CREATE TABLE IF NOT EXISTS declarations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      declaration_type TEXT NOT NULL CHECK(declaration_type IN ('INITIAL_HOLDING','ANNUAL_HOLDING','TRANSACTION','RELATIVE_UPDATE')),
      details_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      acknowledged_by TEXT REFERENCES users(id),
      acknowledged_at TEXT
    );

    -- Append-only audit trail across the whole system (regulator-facing requirement)
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      metadata_json TEXT,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Mutual fund / AMC surveillance: the scheme's own trades, logged for comparison against
    -- employee trades (front-running detection under SEBI's 2022 institutional mechanism circular).
    -- Also usable by non-AMC clients simply as a company trade log if relevant.
    CREATE TABLE IF NOT EXISTS scheme_trades (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      scheme_name TEXT NOT NULL,
      security_name TEXT NOT NULL,
      isin TEXT,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('BUY','SELL')),
      quantity INTEGER NOT NULL,
      trade_date TEXT NOT NULL,
      logged_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Auto-generated whenever an employee trade (pre-clearance approval or a TRANSACTION
    -- declaration) falls within the surveillance window of a scheme trade in the same security.
    CREATE TABLE IF NOT EXISTS surveillance_alerts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      alert_type TEXT NOT NULL DEFAULT 'FRONT_RUNNING_PATTERN',
      security_name TEXT NOT NULL,
      employee_user_id TEXT NOT NULL REFERENCES users(id),
      employee_source TEXT NOT NULL, -- 'PRECLEARANCE' or 'DECLARATION'
      employee_source_id TEXT NOT NULL,
      scheme_trade_id TEXT NOT NULL REFERENCES scheme_trades(id),
      days_between INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REVIEWED','DISMISSED','ESCALATED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      review_note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_restricted_tenant ON restricted_list(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_preclearance_tenant ON preclearance_requests(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_upsi_tenant ON upsi_entries(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_declarations_tenant ON declarations(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_scheme_trades_tenant ON scheme_trades(tenant_id, security_name);
    CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON surveillance_alerts(tenant_id);
  `);
}

const SURVEILLANCE_WINDOW_DAYS = 7;

/**
 * Compares one employee-side trade (a security + date) against all logged scheme trades
 * in the same security within the surveillance window, and creates an alert for each match
 * that doesn't already have one. This is the front-running detection SEBI's 2022 institutional
 * mechanism circular expects AMCs to run — approximate, but a real starting point.
 */
export function runSurveillanceCheck(
  db: DatabaseSync,
  params: {
    tenantId: string;
    securityName: string;
    isin?: string | null;
    employeeUserId: string;
    employeeTradeDate: string; // ISO date
    source: "PRECLEARANCE" | "DECLARATION";
    sourceId: string;
  }
) {
  const schemeTrades = db
    .prepare(
      `SELECT id, trade_date as tradeDate FROM scheme_trades
       WHERE tenant_id = ? AND (security_name = ? OR (isin IS NOT NULL AND isin = ?))`
    )
    .all(params.tenantId, params.securityName, params.isin ?? "") as { id: string; tradeDate: string }[];

  const employeeDate = new Date(params.employeeTradeDate).getTime();
  const alerts: string[] = [];

  for (const trade of schemeTrades) {
    const schemeDate = new Date(trade.tradeDate).getTime();
    const daysBetween = Math.round(Math.abs(employeeDate - schemeDate) / (1000 * 60 * 60 * 24));
    if (daysBetween > SURVEILLANCE_WINDOW_DAYS) continue;

    const existing = db
      .prepare(
        `SELECT id FROM surveillance_alerts WHERE tenant_id = ? AND employee_source = ? AND employee_source_id = ? AND scheme_trade_id = ?`
      )
      .get(params.tenantId, params.source, params.sourceId, trade.id);
    if (existing) continue;

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO surveillance_alerts (id, tenant_id, security_name, employee_user_id, employee_source, employee_source_id, scheme_trade_id, days_between)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, params.tenantId, params.securityName, params.employeeUserId, params.source, params.sourceId, trade.id, daysBetween);
    alerts.push(id);
  }

  return alerts;
}

export function logAudit(
  db: DatabaseSync,
  params: { tenantId: string; actorId: string | null; action: string; entity: string; entityId?: string; metadata?: unknown }
) {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO audit_log (id, tenant_id, actor_id, action, entity, entity_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.tenantId,
    params.actorId,
    params.action,
    params.entity,
    params.entityId ?? null,
    params.metadata ? JSON.stringify(params.metadata) : null
  );
}
