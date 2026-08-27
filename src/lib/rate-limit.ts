// Minimal in-memory rate limiter. Fine for a single-instance demo deployment;
// for real production multi-instance hosting, replace with a shared store (Redis, etc.)
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) return true;
  return false;
}
