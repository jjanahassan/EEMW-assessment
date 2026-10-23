import { API_URL, TOKEN_KEY } from "./constants";
import type { FieldError } from "./types";

export const AUTH_EXPIRED_EVENT = "auth:expired";

export const tokenStorage = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const e = body?.error;
    return new ApiError(res.status, e?.code ?? "ERROR", e?.message ?? res.statusText, Array.isArray(e?.details) ? e.details : []);
  } catch {
    return new ApiError(res.status, "ERROR", res.statusText || "Request failed");
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit | null };

export async function apiFetch(path: string, { json, body, headers: extra, ...init }: Options = {}): Promise<Response> {
  const headers = new Headers(extra);
  const token = tokenStorage.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  } // FormData: leave Content-Type alone, the browser adds the multipart boundary

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, body });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check that the API is running.");
  }

  if (res.status === 401 && token) {
    tokenStorage.clear();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT)); // AuthProvider listens and logs out
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function api<T>(path: string, options?: Options): Promise<T> {
  return (await apiFetch(path, options)).json() as Promise<T>;
}

export const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}