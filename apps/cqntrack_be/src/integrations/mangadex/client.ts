const MANGADEX_BASE_URL = "https://api.mangadex.org";

// A MangaDex exige um User-Agent de verdade em toda requisição (não pode
// ser falsificado nem omitido — 403/banimento temporário em caso de
// violação, ver api.mangadex.org/docs/2-limitations/). Diferente de
// IGDB/TMDB/Google Books, essa API é 100% pública pra GET (busca, detalhe,
// aggregate) — sem key nem OAuth, então nenhuma função deste módulo recebe
// `Env`.
const USER_AGENT = "cqntrack/1.0 (+https://tracker.cqn.xyz.br)";

export class MangaDexRequestError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Requisição à MangaDex falhou (status ${status}): ${body}`);
    this.name = "MangaDexRequestError";
  }
}

export async function mangadexFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${MANGADEX_BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new MangaDexRequestError(res.status, await res.text());
  }
  return (await res.json()) as T;
}
