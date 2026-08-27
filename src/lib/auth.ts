import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getDb } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
const COOKIE_NAME = "itp_session";

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
  return jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
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
    return jwt.verify(token, JWT_SECRET) as SessionUser;
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
