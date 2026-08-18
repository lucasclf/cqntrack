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

// Wrapper fino sobre fetch pra qualquer rota /api/* — sempre manda a cookie
// de sessão (credentials: include, necessário porque FE e BE vivem em
// subdomínios diferentes em produção) e converte respostas não-2xx em
// ApiError em vez de deixar o .json() falhar silenciosamente depois.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `Falha na requisição para ${path} (status ${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// Upload de arquivo (multipart/form-data) — não passa por `request()` porque
// esse sempre força Content-Type: application/json; aqui o boundary do
// multipart precisa ser definido pelo próprio browser a partir do FormData,
// então o header de Content-Type não pode ser setado manualmente.
async function requestForm<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
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
