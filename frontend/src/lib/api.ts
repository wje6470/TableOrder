import { customerAuth, storeAuth } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type Role = "customer" | "store" | "none";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  role: Role,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (role === "customer") {
    const token = customerAuth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } else if (role === "store") {
    const token = storeAuth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestForm<T>(path: string, role: Role, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  if (role === "customer") {
    const token = customerAuth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } else if (role === "store") {
    const token = storeAuth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: formData });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, role: Role = "none") => request<T>("GET", path, role),
  post: <T>(path: string, body: unknown, role: Role = "none") => request<T>("POST", path, role, body),
  put: <T>(path: string, body: unknown, role: Role = "none") => request<T>("PUT", path, role, body),
  patch: <T>(path: string, body: unknown, role: Role = "none") => request<T>("PATCH", path, role, body),
  delete: <T>(path: string, role: Role = "none") => request<T>("DELETE", path, role),
  postForm: <T>(path: string, formData: FormData, role: Role = "none") => requestForm<T>(path, role, formData),
};

export { ApiError };
