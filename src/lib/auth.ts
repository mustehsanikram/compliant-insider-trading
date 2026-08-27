import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getDb } from "./db";

const JWT_SECRET_ENV = process.env.JWT_SECRET;
const INSECURE_DEFAULT = "dev-only-insecure-secret-change-me";

function getJwtSecret(): string {
  if (process.env.NODE_ENV === "production" && (!JWT_SECRET_ENV || JWT_SECRET_ENV === INSECURE_DEFAULT)) {
    throw new Error(
      "JWT_SECRET is not set. Refusing to operate in production with the default secret — set a real random JWT_SECRET environment variable and redeploy."
    );
  }
  return JWT_SECRET_ENV || INSECURE_DEFAULT;
}

const COOKIE_NAME = "itp_session";
const MFA_PENDING_COOKIE = "itp_mfa_pending";

export type Role = "EMPLOYEE" | "COMPLIANCE_OFFICER" | "ADMIN";

export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: Role;
  designatedPerson: boolean;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: "8h" });
}

export async function setSessionCookie(user: SessionUser) {
  const token = signSession(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as SessionUser;
  } catch {
    return null;
  }
}

export function requireRole(user: SessionUser | null, roles: Role[]): user is SessionUser {
  return !!user && roles.includes(user.role);
}

// Convenience: look up a fresh user row by id (in case role/flags changed since token issue)
export function getUserById(id: string) {
  const db = getDb();
  return db
    .prepare(`SELECT id, tenant_id as tenantId, email, full_name as fullName, role, designated_person as designatedPerson FROM users WHERE id = ?`)
    .get(id) as
    | { id: string; tenantId: string; email: string; fullName: string; role: Role; designatedPerson: number }
    | undefined;
}

// --- MFA pending step: issued right after password verification succeeds for a user
// with MFA enabled. Short-lived (5 min), carries only the user id — never a full session.

interface MfaPendingPayload {
  userId: string;
  purpose: "mfa_pending";
}

export async function setMfaPendingCookie(userId: string) {
  const token = jwt.sign({ userId, purpose: "mfa_pending" } satisfies MfaPendingPayload, getJwtSecret(), { expiresIn: "5m" });
  const store = await cookies();
  store.set(MFA_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });
}

export async function getMfaPendingUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(MFA_PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as MfaPendingPayload;
    if (payload.purpose !== "mfa_pending") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export async function clearMfaPendingCookie() {
  const store = await cookies();
  store.delete(MFA_PENDING_COOKIE);
}
