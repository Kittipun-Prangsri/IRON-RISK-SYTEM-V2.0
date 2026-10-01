// Client for the Express backend (proxied at /api by next.config.ts).

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: { row: number; name: string; error: string }[]) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) {
    // Session expired or account suspended — back to the login page.
    window.location.replace("/?error=session");
    throw new ApiError("กรุณาเข้าสู่ระบบ", 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error || `เกิดข้อผิดพลาด (${res.status})`, res.status, data?.details);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
}
