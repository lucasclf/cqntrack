import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { series, seriesEpisodeWatch, seriesWatchProgress, user } from "../db/schema";
import { refreshTrackedSeriesEpisodes } from "./refresh-episodes.job";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tmdbSeriesDetail(id: number, lastEpisodeAirDate: string) {
  return {
    id,
    name: `Série ${id}`,
    poster_path: `/poster-${id}.jpg`,
    first_air_date: "2008-01-20",
    overview: `Resumo da série ${id}`,
    genres: [{ id: 18, name: "Drama" }],
    number_of_seasons: 1,
    number_of_episodes: 3,
    vote_average: 8,
    seasons: [],
    last_episode_to_air: {
      episode_number: 3,
      season_number: 1,
      name: "Final",
      air_date: lastEpisodeAirDate,
    },
  };
}

// getOrCacheSeries só rebusca na TMDB se o cache tiver mais de 24h (ver
// isStale em series.service.ts) — em produção isso sempre vale por o cron
// rodar 1x/dia, mas no teste o cache acabou de ser escrito no mesmo
// instante. Envelhece a linha artificialmente pra simular "rodou ontem".
async function ageSeriesCache(db: ReturnType<typeof createDb>, tmdbId: number) {
  await db
    .update(series)
    .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
    .where(eq(series.tmdbId, tmdbId));
}

async function markEpisodeWatched(cookie: string, tmdbId: number) {
  // fetchCredits: true por padrão em ensureSeriesEntry (chamado por
  // setEpisodeWatched) — 2 responses, mesma ordem de series.routes.test.ts.
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tmdbSeriesDetail(tmdbId, "2025-01-01")))
      .mockResolvedValueOnce(jsonResponse({ cast: [], crew: [] })),
  );
  await app.request(
    `/api/series/${tmdbId}/episodes/1/1`,
    {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ watched: true }),
    },
    env,
  );
  vi.unstubAllGlobals();
}

describe("refreshTrackedSeriesEpisodes", () => {
  it("atualiza só séries com pelo menos 1 episódio assistido, não as só favoritadas", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const db = createDb(env);

    await markEpisodeWatched(cookie, 801);
    await ageSeriesCache(db, 801);

    // Favoritada, mas nenhum episódio assistido — não deveria entrar no refresh.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(tmdbSeriesDetail(802, "2025-01-01")))
        .mockResolvedValueOnce(jsonResponse({ cast: [], crew: [] })),
    );
    await app.request(
      "/api/series/802/entry",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: "{}" },
      env,
    );
    vi.unstubAllGlobals();

    const requestedIds: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const match = /\/tv\/(\d+)/.exec(url);
        const id = Number(match?.[1]);
        // getOrCacheSeries (fetchCredits: true por padrão) sempre faz 2
        // requests por série: detalhe, depois aggregate_credits.
        if (url.includes("/aggregate_credits")) {
          return jsonResponse({ cast: [], crew: [] });
        }
        requestedIds.push(id);
        return jsonResponse(tmdbSeriesDetail(id, "2026-06-01"));
      }),
    );

    await refreshTrackedSeriesEpisodes(env, db);
    vi.unstubAllGlobals();

    expect(requestedIds).toEqual([801]);

    const [updated] = await db.select().from(series).where(eq(series.tmdbId, 801));
    expect(updated?.lastEpisodeToAir).toEqual({
      seasonNumber: 1,
      episodeNumber: 3,
      name: "Final",
      airDate: "2026-06-01",
    });
  });

  it("erro numa série não impede o refresh das demais", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const db = createDb(env);

    await markEpisodeWatched(cookie, 803);
    await markEpisodeWatched(cookie, 804);
    await ageSeriesCache(db, 803);
    await ageSeriesCache(db, 804);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const match = /\/tv\/(\d+)/.exec(url);
        const id = Number(match?.[1]);
        if (url.includes("/aggregate_credits")) {
          return jsonResponse({ cast: [], crew: [] });
        }
        if (id === 803) {
          return new Response("upstream error", { status: 500 });
        }
        return jsonResponse(tmdbSeriesDetail(id, "2026-06-01"));
      }),
    );

    await expect(refreshTrackedSeriesEpisodes(env, db)).resolves.toBeUndefined();
    vi.unstubAllGlobals();

    const [series804] = await db.select().from(series).where(eq(series.tmdbId, 804));
    expect(series804?.lastEpisodeToAir).toEqual({
      seasonNumber: 1,
      episodeNumber: 3,
      name: "Final",
      airDate: "2026-06-01",
    });
  });
});

describe("refreshTrackedSeriesEpisodes — progresso de episódio pendente (series_watch_progress)", () => {
  async function getUserId(db: ReturnType<typeof createDb>, email: string): Promise<string> {
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!row) throw new Error("usuário de teste não encontrado");
    return row.id;
  }

  it("acha o episódio pulado (fora de ordem), não o mais recente lançado", async () => {
    const { cookie, email } = await createAuthenticatedUser(app, env);
    const db = createDb(env);
    const userId = await getUserId(db, email);

    // Assiste o 1x1 (cria o cache da série) e pula direto pro 1x3, sem
    // passar pelo 1x2 — grava direto no banco, sem precisar de mais uma
    // rodada de fetch mockado só pra isso.
    await markEpisodeWatched(cookie, 901);
    await db
      .insert(seriesEpisodeWatch)
      .values({ userId, seriesId: 901, seasonNumber: 1, episodeNumber: 3 });
    await ageSeriesCache(db, 901);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/aggregate_credits")) {
          return jsonResponse({ cast: [], crew: [] });
        }
        if (url.includes("/season/")) {
          return jsonResponse({
            season_number: 1,
            episodes: [
              { episode_number: 1, season_number: 1, name: "Episódio 1", air_date: "2020-01-01" },
              { episode_number: 2, season_number: 1, name: "Episódio 2", air_date: "2020-01-08" },
              { episode_number: 3, season_number: 1, name: "Episódio 3", air_date: "2020-01-15" },
            ],
          });
        }
        return jsonResponse({
          ...tmdbSeriesDetail(901, "2020-01-15"),
          seasons: [
            {
              season_number: 1,
              name: "Temporada 1",
              episode_count: 3,
              air_date: "2020-01-01",
              poster_path: null,
            },
          ],
        });
      }),
    );

    await refreshTrackedSeriesEpisodes(env, db);
    vi.unstubAllGlobals();

    const [progress] = await db
      .select()
      .from(seriesWatchProgress)
      .where(and(eq(seriesWatchProgress.userId, userId), eq(seriesWatchProgress.seriesId, 901)));

    // O 1x3 já foi assistido (fora de ordem) e o 1x1 também — o pendente de
    // verdade é o 1x2, não "o mais recente lançado" (que seria o 1x3).
    expect(progress?.nextEpisodeSeasonNumber).toBe(1);
    expect(progress?.nextEpisodeNumber).toBe(2);
    expect(progress?.nextEpisodeName).toBe("Episódio 2");
  });

  it("remove o registro quando o usuário termina de assistir tudo que já foi ao ar", async () => {
    const { cookie, email } = await createAuthenticatedUser(app, env);
    const db = createDb(env);
    const userId = await getUserId(db, email);

    await markEpisodeWatched(cookie, 902);
    await ageSeriesCache(db, 902);

    function stubFetch() {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes("/aggregate_credits")) {
            return jsonResponse({ cast: [], crew: [] });
          }
          if (url.includes("/season/")) {
            return jsonResponse({
              season_number: 1,
              episodes: [
                { episode_number: 1, season_number: 1, name: "Episódio 1", air_date: "2020-01-01" },
                { episode_number: 2, season_number: 1, name: "Episódio 2", air_date: "2020-01-08" },
              ],
            });
          }
          return jsonResponse({
            ...tmdbSeriesDetail(902, "2020-01-08"),
            seasons: [
              {
                season_number: 1,
                name: "Temporada 1",
                episode_count: 2,
                air_date: "2020-01-01",
                poster_path: null,
              },
            ],
          });
        }),
      );
    }

    // 1ª rodada: só o 1x1 assistido — o 1x2 fica pendente, gera registro.
    stubFetch();
    await refreshTrackedSeriesEpisodes(env, db);
    vi.unstubAllGlobals();

    const [pending] = await db
      .select()
      .from(seriesWatchProgress)
      .where(and(eq(seriesWatchProgress.userId, userId), eq(seriesWatchProgress.seriesId, 902)));
    expect(pending?.nextEpisodeNumber).toBe(2);

    // Assiste o 1x2 — não sobra episódio pendente já lançado.
    await db
      .insert(seriesEpisodeWatch)
      .values({ userId, seriesId: 902, seasonNumber: 1, episodeNumber: 2 });

    stubFetch();
    await refreshTrackedSeriesEpisodes(env, db);
    vi.unstubAllGlobals();

    const remaining = await db
      .select()
      .from(seriesWatchProgress)
      .where(and(eq(seriesWatchProgress.userId, userId), eq(seriesWatchProgress.seriesId, 902)));
    expect(remaining).toHaveLength(0);
  });
});
