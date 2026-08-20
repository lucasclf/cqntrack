import type { SeriesSeasonEpisodesResponse, SeriesSeasonSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./SeriesEpisodeList.module.css";

interface SeriesEpisodeListProps {
  tmdbId: number;
  seasons: SeriesSeasonSummary[];
  // Temporada padrão já buscada pelo SeriesDetail em paralelo com o
  // detalhe da série — evita um segundo "carregando" logo após a página
  // aparecer. null quando a série não tem essa temporada (ou o pai ainda
  // não terminou de buscar); nesses casos a busca cai pro fluxo normal.
  initialSeasonData?: SeriesSeasonEpisodesResponse | null;
  // Temporada pedida via link externo (ex.: "Continuar assistindo" na
  // Home, que já sabe o próximo episódio pendente — ver ContinueWatching.tsx)
  // — null/inexistente na série cai no padrão de sempre (Temporada 1).
  initialSeasonNumber?: number | null;
  // Próxima temporada com episódios não assistidos, calculada pelo backend
  // (ver GET /api/series/:tmdbId) — usada como padrão quando não veio
  // initialSeasonNumber, pra não abrir sempre na Temporada 1 mesmo com
  // temporadas inteiras já vistas.
  nextSeasonToWatch?: number | null;
  // Série marcada como abandonada (ver SeriesDetail) — ao marcar qualquer
  // episódio como assistido, pergunta se quer voltar a acompanhar.
  abandoned: boolean;
  onResume: () => void;
}

type SeasonCache = ReadonlyMap<number, SeriesSeasonEpisodesResponse>;

function pickDefaultSeason(
  seasons: SeriesSeasonSummary[],
  initialSeasonNumber?: number | null,
  nextSeasonToWatch?: number | null,
): number | null {
  if (
    initialSeasonNumber != null &&
    seasons.some((season) => season.seasonNumber === initialSeasonNumber)
  ) {
    return initialSeasonNumber;
  }
  if (
    nextSeasonToWatch != null &&
    seasons.some((season) => season.seasonNumber === nextSeasonToWatch)
  ) {
    return nextSeasonToWatch;
  }
  return (seasons.find((season) => season.seasonNumber === 1) ?? seasons[0])?.seasonNumber ?? null;
}

// initialSeasonData é sempre a temporada que o SeriesDetail decidiu
// pré-buscar em paralelo (initialSeasonNumber ?? 1 — ver SeriesDetail.tsx),
// que pode não bater com a temporada padrão aqui (quando o padrão vem de
// nextSeasonToWatch, só conhecido depois da resposta do detalhe). Mesmo
// assim vale guardar no cache pelo número real dela: evita rebuscar se o
// usuário clicar manualmente nessa aba depois.
function buildInitialCache(
  initialSeasonData: SeriesSeasonEpisodesResponse | null | undefined,
): SeasonCache {
  if (!initialSeasonData) return new Map();
  return new Map([[initialSeasonData.seasonNumber, initialSeasonData]]);
}

// Lista de episódios de uma temporada, buscada ao vivo na TMDB (sem cache
// local, ver comentário em db/schema/series.schema.ts no backend) — só o
// "assistido" é nosso. Abre na temporada pedida via initialSeasonNumber, ou
// senão em nextSeasonToWatch (calculado pelo backend), ou senão na
// Temporada 1. Cada temporada já vista fica guardada em memória (`cache`)
// pelo tempo de vida do componente, pra trocar de aba ser instantâneo em
// vez de recarregar tudo toda vez — e a temporada inicial já chega pronta
// via `initialSeasonData`, sem flash nem na primeira vez.
export function SeriesEpisodeList({
  tmdbId,
  seasons,
  initialSeasonData,
  initialSeasonNumber,
  nextSeasonToWatch,
  abandoned,
  onResume,
}: SeriesEpisodeListProps) {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(
    pickDefaultSeason(seasons, initialSeasonNumber, nextSeasonToWatch),
  );
  const [cache, setCache] = useState<SeasonCache>(() => buildInitialCache(initialSeasonData));
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [seasonActionPending, setSeasonActionPending] = useState(false);

  // Troca de série (mesmo componente, :tmdbId da rota mudou sem remontar) —
  // o cache é só de episódios em memória, não pode sobreviver a isso.
  // Ajustado durante o render (mesmo padrão de SeriesDetail pro :tmdbId).
  const [trackedTmdbId, setTrackedTmdbId] = useState(tmdbId);
  if (tmdbId !== trackedTmdbId) {
    setTrackedTmdbId(tmdbId);
    setSelectedSeason(pickDefaultSeason(seasons, initialSeasonNumber, nextSeasonToWatch));
    setCache(new Map());
    setLoadError(false);
  }

  useEffect(() => {
    if (selectedSeason === null || cache.has(selectedSeason)) {
      return;
    }
    let cancelled = false;

    apiClient
      .get<SeriesSeasonEpisodesResponse>(`/api/series/${tmdbId}/seasons/${selectedSeason}`)
      .then((response) => {
        if (cancelled) return;
        setCache((current) => new Map(current).set(selectedSeason, response));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, selectedSeason, cache]);

  function updateCachedSeason(
    seasonNumber: number,
    updater: (season: SeriesSeasonEpisodesResponse) => SeriesSeasonEpisodesResponse,
  ) {
    setCache((current) => {
      const existing = current.get(seasonNumber);
      if (!existing) return current;
      return new Map(current).set(seasonNumber, updater(existing));
    });
  }

  // Otimista: atualiza a UI antes da resposta do PUT, reverte se falhar —
  // marcar episódio é uma ação frequente, esperar o round-trip toda vez
  // deixaria a lista visivelmente lenta.
  //
  // Ao marcar (não ao desmarcar) um episódio: (1) se há episódio(s)
  // anterior(es) da mesma temporada ainda não assistido(s) — ex.: marcou o
  // 3 sem ter visto o 1 e o 2 —, pergunta se quer marcar os anteriores
  // junto; (2) se a série está abandonada, pergunta se quer voltar a
  // acompanhar. As duas perguntas são independentes entre si.
  async function toggleEpisode(episodeNumber: number, watched: boolean) {
    if (selectedSeason === null) return;
    const seasonData = cache.get(selectedSeason);

    let episodeNumbersToMark = [episodeNumber];
    if (watched && seasonData) {
      const earlierUnwatched = seasonData.episodes
        .filter((episode) => episode.episodeNumber < episodeNumber && !episode.watched)
        .map((episode) => episode.episodeNumber);
      if (
        earlierUnwatched.length > 0 &&
        window.confirm(
          earlierUnwatched.length === 1
            ? "Você ainda não marcou o episódio anterior desta temporada como assistido. Marcar ele também?"
            : `Você ainda não marcou ${earlierUnwatched.length} episódios anteriores desta temporada como assistidos. Marcar eles também?`,
        )
      ) {
        episodeNumbersToMark = [...earlierUnwatched, episodeNumber];
      }
    }

    if (
      watched &&
      abandoned &&
      window.confirm("Esta série está marcada como abandonada. Quer voltar a acompanhá-la?")
    ) {
      onResume();
    }

    setActionError(null);
    updateCachedSeason(selectedSeason, (season) => ({
      ...season,
      episodes: season.episodes.map((episode) =>
        episodeNumbersToMark.includes(episode.episodeNumber) ? { ...episode, watched } : episode,
      ),
    }));
    try {
      await Promise.all(
        episodeNumbersToMark.map((number) =>
          apiClient.put(`/api/series/${tmdbId}/episodes/${selectedSeason}/${number}`, {
            watched,
          }),
        ),
      );
    } catch {
      setActionError("Falha ao salvar. Tente novamente.");
      updateCachedSeason(selectedSeason, (season) => ({
        ...season,
        episodes: season.episodes.map((episode) =>
          episodeNumbersToMark.includes(episode.episodeNumber)
            ? { ...episode, watched: !watched }
            : episode,
        ),
      }));
    }
  }

  async function toggleSeason() {
    if (selectedSeason === null) return;
    const current = cache.get(selectedSeason);
    if (!current) return;
    const allWatched =
      current.episodes.length > 0 && current.episodes.every((episode) => episode.watched);
    const nextWatched = !allWatched;
    if (!nextWatched && !window.confirm("Desmarcar todos os episódios desta temporada?")) {
      return;
    }

    setActionError(null);
    setSeasonActionPending(true);
    try {
      await apiClient.put(`/api/series/${tmdbId}/seasons/${selectedSeason}`, {
        watched: nextWatched,
      });
      updateCachedSeason(selectedSeason, (season) => ({
        ...season,
        episodes: season.episodes.map((episode) => ({ ...episode, watched: nextWatched })),
      }));
    } catch {
      setActionError("Falha ao salvar. Tente novamente.");
    } finally {
      setSeasonActionPending(false);
    }
  }

  if (seasons.length === 0) {
    return null;
  }

  const data = selectedSeason !== null ? (cache.get(selectedSeason) ?? null) : null;
  const allWatched =
    data !== null && data.episodes.length > 0 && data.episodes.every((episode) => episode.watched);

  return (
    <section className={styles.section}>
      <h2>Episódios</h2>
      {actionError && <p role="alert">{actionError}</p>}

      <div className={styles.seasonTabs} role="tablist">
        {seasons.map((season) => (
          <button
            key={season.seasonNumber}
            type="button"
            role="tab"
            aria-selected={season.seasonNumber === selectedSeason}
            className={styles.seasonTab}
            onClick={() => {
              setSelectedSeason(season.seasonNumber);
              setLoadError(false);
            }}
          >
            {season.name}
          </button>
        ))}
      </div>

      {data === null && !loadError && <p className={styles.hint}>Carregando episódios...</p>}
      {loadError && <p role="alert">Falha ao carregar os episódios.</p>}

      {data && (
        <>
          <button
            type="button"
            className={styles.seasonToggle}
            disabled={seasonActionPending}
            onClick={toggleSeason}
          >
            {allWatched ? "Desmarcar temporada inteira" : "Marcar temporada inteira"}
          </button>

          <ul className={styles.episodeList}>
            {data.episodes.map((episode) => (
              <li key={episode.episodeNumber} className={styles.episode}>
                <Link
                  to={`/series/${tmdbId}/temporadas/${selectedSeason}/episodios/${episode.episodeNumber}`}
                  className={styles.episodeLink}
                >
                  {episode.stillUrl ? (
                    <img className={styles.still} src={episode.stillUrl} alt="" loading="lazy" />
                  ) : (
                    <div className={styles.stillPlaceholder} aria-hidden="true" />
                  )}
                  <div className={styles.episodeInfo}>
                    <p className={styles.episodeName}>
                      {episode.episodeNumber}. {episode.name}
                    </p>
                    {episode.airDate && <p className={styles.episodeDate}>{episode.airDate}</p>}
                  </div>
                </Link>
                <label className={styles.watchedToggle}>
                  <input
                    type="checkbox"
                    checked={episode.watched}
                    onChange={(event) => toggleEpisode(episode.episodeNumber, event.target.checked)}
                  />
                  <span>Assistido</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
