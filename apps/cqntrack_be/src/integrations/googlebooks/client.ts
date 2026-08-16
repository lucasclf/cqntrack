const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";

export class GoogleBooksRequestError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Requisição à Google Books falhou (status ${status}): ${body}`);
    this.name = "GoogleBooksRequestError";
  }
}

// GET com API key simples na query string — a Google Books não usa OAuth
// (diferente da IGDB) nem Bearer token de longa duração (diferente da
// TMDB). Sem rate limiter dedicado: o limite da Google Books é por cota
// diária de projeto, não req/s.
export async function googleBooksFetch<T>(env: Env, path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${GOOGLE_BOOKS_BASE_URL}${path}${separator}key=${env.GOOGLE_BOOKS_API_KEY}`,
  );

  if (!res.ok) {
    throw new GoogleBooksRequestError(res.status, await res.text());
  }
  return (await res.json()) as T;
}
