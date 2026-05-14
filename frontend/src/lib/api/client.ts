const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const STORAGE_KEY = "tempus.auth";

function getToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let body = rest.body;
  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...rest, body, headers: finalHeaders });
  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const detail =
      typeof payload === "object" && payload && "detail" in (payload as Record<string, unknown>)
        ? (payload as { detail: unknown }).detail
        : payload;
    throw new ApiError(res.status, detail);
  }

  return payload as T;
}
