import { getAuthToken } from "./mobile-token-storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Variante mobile de api-client.ts (trocada via alias do Vite, ver
// vite.config.ts) — manda o bearer token guardado (ver
// mobile-token-storage.ts) via Authorization em vez de `credentials:
// "include"`, que não teria efeito nenhum aqui (sem cookie de sessão
// disponível dentro do WebView do Capacitor).
async function authHeaders(extra?: HeadersInit): Promise<Headers> {
  const token = await getAuthToken();
  const headers = new Headers(extra);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: await authHeaders({ "Content-Type": "application/json", ...init?.headers }),
  });

  if (!res.ok) {
    throw new ApiError(res.status, `Falha na requisição para ${path} (status ${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// Mesmo motivo de requestForm em api-client.ts: sem Content-Type manual,
// pro browser montar o boundary do multipart sozinho a partir do FormData.
async function requestForm<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: await authHeaders(init?.headers),
    body: formData,
  });

  if (!res.ok) {
    throw new ApiError(res.status, `Falha na requisição para ${path} (status ${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  putForm: <T>(path: string, formData: FormData) =>
    requestForm<T>(path, formData, { method: "PUT" }),
};
