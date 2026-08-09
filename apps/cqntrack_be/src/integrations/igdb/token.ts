import { eq } from "drizzle-orm";
import type { createDb } from "../../db/client";
import { igdbToken } from "../../db/schema";

type Db = ReturnType<typeof createDb>;

// Renova o token antes do vencimento real, pra nunca usar um que expira no
// meio de uma request.
const SAFETY_MARGIN_MS = 5 * 60 * 1000;

// Cache em memória por isolate — evita 1 leitura no D1 a cada chamada da IGDB
// enquanto o isolate estiver vivo. Reinicia quando o Worker sobe um isolate novo,
// mas nesse caso a tabela igdb_token no D1 ainda tem o token válido.
let memoryCache: { accessToken: string; expiresAt: number } | null = null;

export class IgdbAuthError extends Error {
  constructor(status: number, body: string) {
    super(`Falha ao autenticar na IGDB/Twitch (status ${status}): ${body}`);
    this.name = "IgdbAuthError";
  }
}

export async function getIgdbAccessToken(env: Env, db: Db): Promise<string> {
  const now = Date.now();

  if (memoryCache && memoryCache.expiresAt - SAFETY_MARGIN_MS > now) {
    return memoryCache.accessToken;
  }

  const [cached] = await db.select().from(igdbToken).where(eq(igdbToken.id, 1));
  if (cached && cached.expiresAt.getTime() - SAFETY_MARGIN_MS > now) {
    memoryCache = { accessToken: cached.accessToken, expiresAt: cached.expiresAt.getTime() };
    return cached.accessToken;
  }

  return refreshIgdbAccessToken(env, db);
}

export async function refreshIgdbAccessToken(env: Env, db: Db): Promise<string> {
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", env.IGDB_CLIENT_ID);
  url.searchParams.set("client_secret", env.IGDB_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new IgdbAuthError(res.status, await res.text());
  }

  const { access_token: accessToken, expires_in: expiresIn } = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  const expiresAt = Date.now() + expiresIn * 1000;

  await db
    .insert(igdbToken)
    .values({ id: 1, accessToken, expiresAt: new Date(expiresAt) })
    .onConflictDoUpdate({
      target: igdbToken.id,
      set: { accessToken, expiresAt: new Date(expiresAt) },
    });

  memoryCache = { accessToken, expiresAt };
  return accessToken;
}

// Só para testes: evita que o cache em memória vaze de um teste pro outro.
export function resetIgdbTokenMemoryCache(): void {
  memoryCache = null;
}
