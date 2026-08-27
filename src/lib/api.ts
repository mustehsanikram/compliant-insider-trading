export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.error?.formErrors?.join(", ") || data.error)) || "Request failed";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data as T;
}
