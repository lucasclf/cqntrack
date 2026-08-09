import type { createDb } from "../../db/client";
import { waitForRateLimitSlot } from "./rate-limiter";
import { getIgdbAccessToken, refreshIgdbAccessToken } from "./token";

type Db = ReturnType<typeof createDb>;

const IGDB_BASE_URL = "https://api.igdb.com/v4";
const MAX_RATE_LIMIT_RETRIES = 2;

export class IgdbRequestError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Requisição à IGDB falhou (status ${status}): ${body}`);
    this.name = "IgdbRequestError";
  }
}

// POST em linguagem Apicalypse (não JSON) — ver src/integrations/igdb/games.ts
// para exemplos de `body`. Renova o token em 401 (uma vez); faz backoff em 429.
export async function igdbFetch<T>(env: Env, db: Db, endpoint: string, body: string): Promise<T> {
  let accessToken = await getIgdbAccessToken(env, db);
  let refreshedOnce = false;

  for (let attempt = 0; ; attempt++) {
    await waitForRateLimitSlot();

    const res = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": env.IGDB_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain",
      },
      body,
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    if (res.status === 401 && !refreshedOnce) {
      refreshedOnce = true;
      accessToken = await refreshIgdbAccessToken(env, db);
      continue;
    }

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }

    throw new IgdbRequestError(res.status, await res.text());
  }
}
