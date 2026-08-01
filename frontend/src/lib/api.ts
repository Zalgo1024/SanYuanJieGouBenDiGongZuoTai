const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit & { workspaceId?: string } = {}): Promise<T> {
  const { workspaceId: _workspaceId, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body && !(requestOptions.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...requestOptions, headers });
  if (!response.ok) {
    let detail: { code?: string; message?: string } = {};
    try { detail = await response.json(); } catch { /* empty response */ }
    throw new ApiError(detail.message ?? "Request failed", detail.code ?? "request_failed", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiBaseUrl() {
  return API_BASE;
}

// WebSocket 基址：与 API_BASE 同主机，仅协议不同（http→ws）。
export const WS_BASE = API_BASE.replace(/^http/, "ws");
