import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["COMPLIANCE_OFFICER", "ADMIN"])) {
    return NextResponse.json({ error: "Surveillance alerts are restricted to compliance officers and admins." }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, a.alert_type as alertType, a.security_name as securityName, a.employee_source as employeeSource,
              a.days_between as daysBetween, a.status, a.created_at as createdAt, a.review_note as reviewNote,
              u.full_name as employeeName, u.email as employeeEmail,
              st.scheme_name as schemeName, st.transaction_type as schemeTransactionType, st.trade_date as schemeTradeDate, st.quantity as schemeQuantity
       FROM surveillance_alerts a
       JOIN users u ON u.id = a.employee_user_id
       JOIN scheme_trades st ON st.id = a.scheme_trade_id
       WHERE a.tenant_id = ?
       ORDER BY a.created_at DESC`
    )
    .all(session.tenantId);
  return NextResponse.json({ items: rows });
}
