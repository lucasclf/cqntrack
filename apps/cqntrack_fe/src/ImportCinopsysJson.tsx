import type {
  ImportCinopsysMoviesResponse,
  ImportCinopsysSeriesResponse,
  ImportCinopsysShow,
  ImportTvTimeEpisode,
} from "@cqntrack/shared";
import { type ChangeEvent, useRef, useState } from "react";
import styles from "./ImportCinopsysJson.module.css";
import { apiClient } from "./lib/api-client";

// Chunks de filmes por request — sem busca por texto (tmdbId já vem
// resolvido no backup, ver parseBackup abaixo), cada item custa no máximo 1
// fetch à TMDB (getOrCacheMovie com fetchCredits/fetchOverviewFallback:
// false). Mesmo teto de ImportCinopsysMoviesRequestSchema.
const MOVIE_BATCH_SIZE = 20;

// Bin-packing guloso pros lotes de séries: fecha o lote ao atingir 15
// séries OU ~2000 episódios acumulados, o que vier primeiro (mesmo teto de
// ImportCinopsysSeriesRequestSchema pra contagem de séries; o teto de
// episódios é só uma proteção client-side extra contra várias séries
// "pesadas" caindo no mesmo lote e estourando o CPU do Worker).
const SHOW_BATCH_MAX_COUNT = 15;
const SHOW_BATCH_MAX_EPISODES = 2000;

const MAX_TITLE_LENGTH = 300;

type Phase = "idle" | "reading" | "importing-movies" | "importing-series" | "done" | "error";

interface MovieOutcome {
  tmdbId: number;
  title: string;
  status: "imported" | "error";
}

interface SeriesOutcome {
  tmdbId: number;
  title: string;
  status: "imported" | "error";
  episodesImported: number;
}

interface CinopsysMovie {
  tmdbId?: number | null;
  title?: string | null;
  watchState?: string | null;
}

interface CinopsysShow {
  backendId?: string | null;
  tmdbId?: number | null;
  title?: string | null;
}

interface CinopsysEpisode {
  showBackendId?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  isWatched?: boolean | null;
  watchedAt?: string | null;
}

interface CinopsysBackup {
  trakt?: {
    movies?: CinopsysMovie[];
    shows?: CinopsysShow[];
    episodes?: CinopsysEpisode[];
  };
}

interface MovieToImport {
  tmdbId: number;
  title: string;
  status: "watched" | "want_to_watch";
}

interface ParsedBackup {
  movies: MovieToImport[];
  shows: ImportCinopsysShow[];
  ignoredMovies: string[];
  ignoredShows: string[];
}

// Rótulo pro item ignorado na lista de transparência do resumo — cai no
// tmdbId (ou num texto fixo) quando nem o título veio preenchido, já que
// esse é justamente um dos motivos de descarte (ver parseBackup).
function movieLabel(movie: CinopsysMovie): string {
  return movie.title ?? (movie.tmdbId ? `tmdbId ${movie.tmdbId}` : "(sem título)");
}

function showLabel(show: CinopsysShow): string {
  return show.title ?? (show.tmdbId ? `tmdbId ${show.tmdbId}` : "(sem título)");
}

// Todo o parse/filtro roda no navegador, 1x — o Worker só recebe os lotes
// já prontos (ver runImport), porque o plano Free (10ms CPU/request) não
// aguentaria as ~23 mil linhas de episódio do backup inteiro numa
// invocação só.
function parseBackup(data: CinopsysBackup): ParsedBackup | null {
  const rawMovies = data.trakt?.movies;
  const rawShows = data.trakt?.shows;
  const rawEpisodes = data.trakt?.episodes;
  if (!Array.isArray(rawMovies) || !Array.isArray(rawShows) || !Array.isArray(rawEpisodes)) {
    return null;
  }

  const movies: MovieToImport[] = [];
  const ignoredMovies: string[] = [];
  for (const movie of rawMovies) {
    const status =
      movie.watchState === "WATCHED"
        ? "watched"
        : movie.watchState === "WATCHLIST"
          ? "want_to_watch"
          : null;
    if (!movie.tmdbId || !movie.title || movie.title.length > MAX_TITLE_LENGTH || !status) {
      ignoredMovies.push(movieLabel(movie));
      continue;
    }
    movies.push({ tmdbId: movie.tmdbId, title: movie.title, status });
  }

  // Agrupa episódios assistidos por série (showBackendId), depois junta com
  // shows[] pra resolver o tmdbId — série sem nenhum episódio assistido
  // (inclui watchlist-only, descartado de propósito: seriesEntry não tem
  // status de watchlist no cqntrack) ou sem tmdbId é ignorada por inteiro.
  const episodesByShow = new Map<string, ImportTvTimeEpisode[]>();
  for (const episode of rawEpisodes) {
    if (!episode.isWatched || !episode.showBackendId) continue;
    if (episode.seasonNumber == null || episode.seasonNumber < 0) continue;
    if (episode.episodeNumber == null || episode.episodeNumber < 1) continue;

    const list = episodesByShow.get(episode.showBackendId) ?? [];
    list.push({
      season: episode.seasonNumber,
      episode: episode.episodeNumber,
      watchedAt: episode.watchedAt ?? null,
    });
    episodesByShow.set(episode.showBackendId, list);
  }

  const shows: ImportCinopsysShow[] = [];
  const ignoredShows: string[] = [];
  for (const show of rawShows) {
    const episodes = show.backendId ? episodesByShow.get(show.backendId) : undefined;
    if (!show.tmdbId || !show.title || show.title.length > MAX_TITLE_LENGTH || !episodes?.length) {
      ignoredShows.push(showLabel(show));
      continue;
    }
    shows.push({ tmdbId: show.tmdbId, title: show.title, episodes });
  }

  return { movies, shows, ignoredMovies, ignoredShows };
}

// Baixa um JSON no mesmo formato aceito por essa tela (ver CinopsysBackup)
// com só os filmes/séries que falharam, pro usuário poder reimportar depois
// sem precisar separar isso à mão do arquivo original — mesmo espírito de
// downloadErroredCsv em ImportFilmowCsv.tsx/ImportTvTimeCsv.tsx. `backendId`
// é sintético (só precisa ser único e bater entre show/episódio dentro
// desse arquivo — ver parseBackup), então reaproveita o tmdbId como string.
function downloadErroredBackup(movies: MovieToImport[], shows: ImportCinopsysShow[]) {
  const backup: CinopsysBackup = {
    trakt: {
      movies: movies.map((movie) => ({
        tmdbId: movie.tmdbId,
        title: movie.title,
        watchState: movie.status === "watched" ? "WATCHED" : "WATCHLIST",
      })),
      shows: shows.map((show) => ({
        backendId: String(show.tmdbId),
        tmdbId: show.tmdbId,
        title: show.title,
      })),
      episodes: shows.flatMap((show) =>
        show.episodes.map((episode) => ({
          showBackendId: String(show.tmdbId),
          seasonNumber: episode.season,
          episodeNumber: episode.episode,
          isWatched: true,
          watchedAt: episode.watchedAt ?? null,
        })),
      ),
    },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cinopsys-itens-com-erro.json";
  link.click();
  URL.revokeObjectURL(url);
}

function chunkMovies(movies: MovieToImport[]): MovieToImport[][] {
  const batches: MovieToImport[][] = [];
  for (let start = 0; start < movies.length; start += MOVIE_BATCH_SIZE) {
    batches.push(movies.slice(start, start + MOVIE_BATCH_SIZE));
  }
  return batches;
}

function chunkShows(shows: ImportCinopsysShow[]): ImportCinopsysShow[][] {
  const batches: ImportCinopsysShow[][] = [];
  let current: ImportCinopsysShow[] = [];
  let episodeSum = 0;

  for (const show of shows) {
    const wouldOverflow =
      current.length >= SHOW_BATCH_MAX_COUNT ||
      (current.length > 0 && episodeSum + show.episodes.length > SHOW_BATCH_MAX_EPISODES);
    if (wouldOverflow) {
      batches.push(current);
      current = [];
      episodeSum = 0;
    }
    current.push(show);
    episodeSum += show.episodes.length;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

// "Conta" > "Importar dados" > backup JSON do Cinopsys — substitui o antigo
// import do Trakt (a Trakt passou a exigir conta paga pra criar um app,
// então nunca funcionou em produção). O Cinopsys já resolve tmdbId pra cada
// filme/série/episódio no próprio arquivo, então não há busca por texto nem
// chamada a nenhuma API externa aqui — só o parse local (ver parseBackup) e
// os lotes pro backend.
export function ImportCinopsysJson() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [movieProgress, setMovieProgress] = useState({ done: 0, total: 0 });
  const [seriesProgress, setSeriesProgress] = useState({ done: 0, total: 0 });
  const [movieResults, setMovieResults] = useState<MovieOutcome[]>([]);
  const [seriesResults, setSeriesResults] = useState<SeriesOutcome[]>([]);
  const [ignored, setIgnored] = useState<{ movies: string[]; shows: string[] }>({
    movies: [],
    shows: [],
  });
  // Guarda os itens já parseados (não só os resultados) pra poder
  // reconstruir o JSON de retry em downloadErroredBackup — não precisa
  // disparar re-render, então fica em ref em vez de state.
  const parsedMoviesRef = useRef<MovieToImport[]>([]);
  const parsedShowsRef = useRef<ImportCinopsysShow[]>([]);

  async function importMovies(movies: MovieToImport[]) {
    const collected: MovieOutcome[] = [];
    setMovieProgress({ done: 0, total: movies.length });

    for (const batch of chunkMovies(movies)) {
      try {
        const response = await apiClient.post<ImportCinopsysMoviesResponse>(
          "/api/movies/import/cinopsys",
          { movies: batch },
        );
        collected.push(...response.results);
      } catch {
        for (const item of batch) {
          collected.push({ tmdbId: item.tmdbId, title: item.title, status: "error" });
        }
      }
      setMovieProgress((current) => ({ done: current.done + batch.length, total: movies.length }));
      setMovieResults([...collected]);
    }

    // Resumo agregado, não 1 por filme (import roda com logActivity: false,
    // ver import.service.ts no backend). Melhor esforço: falha aqui não
    // trava a tela de resultado.
    const importedCount = collected.filter((r) => r.status === "imported").length;
    if (importedCount > 0) {
      apiClient.post("/api/movies/import/cinopsys/activity", { importedCount }).catch(() => {});
    }
  }

  async function importSeries(shows: ImportCinopsysShow[]) {
    const collected: SeriesOutcome[] = [];
    setSeriesProgress({ done: 0, total: shows.length });

    for (const batch of chunkShows(shows)) {
      try {
        const response = await apiClient.post<ImportCinopsysSeriesResponse>(
          "/api/series/import/cinopsys",
          { shows: batch },
        );
        collected.push(...response.results);
      } catch {
        for (const show of batch) {
          collected.push({
            tmdbId: show.tmdbId,
            title: show.title,
            status: "error",
            episodesImported: 0,
          });
        }
      }
      setSeriesProgress((current) => ({ done: current.done + batch.length, total: shows.length }));
      setSeriesResults([...collected]);
    }

    const importedSeriesCount = collected.filter((r) => r.status === "imported").length;
    const importedEpisodeCount = collected.reduce((sum, r) => sum + r.episodesImported, 0);
    if (importedSeriesCount > 0) {
      apiClient
        .post("/api/series/import/cinopsys/activity", { importedSeriesCount, importedEpisodeCount })
        .catch(() => {});
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setMovieResults([]);
    setSeriesResults([]);
    setIgnored({ movies: [], shows: [] });
    setPhase("reading");

    let data: CinopsysBackup;
    try {
      data = JSON.parse(await file.text()) as CinopsysBackup;
    } catch {
      setPhase("error");
      setError("Não foi possível ler o arquivo — confira se é um JSON válido.");
      return;
    }

    const parsed = parseBackup(data);
    if (!parsed) {
      setPhase("error");
      setError('Arquivo não parece um backup do Cinopsys (esperado "trakt.movies"/"shows").');
      return;
    }
    if (parsed.movies.length === 0 && parsed.shows.length === 0) {
      setPhase("error");
      setError("Nenhum item importável encontrado no arquivo.");
      return;
    }

    setIgnored({ movies: parsed.ignoredMovies, shows: parsed.ignoredShows });
    parsedMoviesRef.current = parsed.movies;
    parsedShowsRef.current = parsed.shows;

    setPhase("importing-movies");
    await importMovies(parsed.movies);
    setPhase("importing-series");
    await importSeries(parsed.shows);
    setPhase("done");
  }

  const busy = phase === "reading" || phase === "importing-movies" || phase === "importing-series";
  const importedMovies = movieResults.filter((r) => r.status === "imported").length;
  const importedSeries = seriesResults.filter((r) => r.status === "imported").length;
  const totalEpisodes = seriesResults.reduce(
    (sum, r) => sum + (r.status === "imported" ? r.episodesImported : 0),
    0,
  );
  const erroredMovies = movieResults.filter((r) => r.status === "error");
  const erroredSeries = seriesResults.filter((r) => r.status === "error");

  // Refs só podem ser lidas em handlers/efeitos, não durante o render (ver
  // react-hooks/refs) — por isso o cruzamento com os itens já parseados
  // (parsedMoviesRef/parsedShowsRef) acontece dentro do onClick, não aqui.
  function handleDownloadErrored() {
    const erroredMovieIds = new Set(erroredMovies.map((r) => r.tmdbId));
    const erroredShowIds = new Set(erroredSeries.map((r) => r.tmdbId));
    downloadErroredBackup(
      parsedMoviesRef.current.filter((m) => erroredMovieIds.has(m.tmdbId)),
      parsedShowsRef.current.filter((s) => erroredShowIds.has(s.tmdbId)),
    );
  }

  return (
    <div className={styles.card}>
      <h3>Filmes e séries assistidos (Cinopsys)</h3>
      <p className={styles.hint}>
        Exporte o backup em JSON do app Cinopsys ("Configurações" &gt; "Exportar dados") e importe
        aqui. Filmes viram "Já vi"/"Quero ver" conforme o status no Cinopsys; séries entram com os
        episódios individualmente marcados como assistidos. Séries só na watchlist do Cinopsys (sem
        nenhum episódio assistido) não são importadas.
      </p>

      <label className={styles.fileLabel}>
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          disabled={busy}
        />
        {busy ? "Importando..." : "Escolher arquivo JSON"}
      </label>

      {phase === "reading" && <p className={styles.hint}>Lendo o arquivo...</p>}
      {phase === "importing-movies" && (
        <p className={styles.hint}>
          Importando filmes {movieProgress.done} de {movieProgress.total}...
        </p>
      )}
      {phase === "importing-series" && (
        <p className={styles.hint}>
          Importando séries {seriesProgress.done} de {seriesProgress.total}...
        </p>
      )}
      {phase === "error" && <p role="alert">{error}</p>}

      {phase === "done" && (
        <div className={styles.summary}>
          <p>
            <strong>{importedMovies}</strong>{" "}
            {importedMovies === 1 ? "filme importado" : "filmes importados"} e{" "}
            <strong>{importedSeries}</strong>{" "}
            {importedSeries === 1 ? "série importada" : "séries importadas"} (
            <strong>{totalEpisodes}</strong>{" "}
            {totalEpisodes === 1 ? "episódio marcado" : "episódios marcados"}).
          </p>

          {erroredMovies.length > 0 && (
            <div role="alert">
              <p>
                {erroredMovies.length}{" "}
                {erroredMovies.length === 1 ? "filme falhou" : "filmes falharam"} ao importar.
              </p>
            </div>
          )}
          {erroredSeries.length > 0 && (
            <div role="alert">
              <p>
                {erroredSeries.length}{" "}
                {erroredSeries.length === 1 ? "série falhou" : "séries falharam"} ao importar.
              </p>
            </div>
          )}

          {(erroredMovies.length > 0 || erroredSeries.length > 0) && (
            <button type="button" className={styles.downloadButton} onClick={handleDownloadErrored}>
              Baixar JSON com os itens que falharam
            </button>
          )}

          {(ignored.movies.length > 0 || ignored.shows.length > 0) && (
            <details>
              <summary>Itens ignorados no arquivo</summary>
              {ignored.movies.length > 0 && (
                <>
                  <p>
                    {ignored.movies.length}{" "}
                    {ignored.movies.length === 1
                      ? "filme sem tmdbId/status reconhecido"
                      : "filmes sem tmdbId/status reconhecido"}
                    :
                  </p>
                  <ul className={styles.notFoundList}>
                    {ignored.movies.map((title, index) => (
                      <li key={`movie-${index}`}>{title}</li>
                    ))}
                  </ul>
                </>
              )}
              {ignored.shows.length > 0 && (
                <>
                  <p>
                    {ignored.shows.length}{" "}
                    {ignored.shows.length === 1
                      ? "série sem tmdbId ou sem episódio assistido (inclui watchlist-only)"
                      : "séries sem tmdbId ou sem episódio assistido (inclui watchlist-only)"}
                    :
                  </p>
                  <ul className={styles.notFoundList}>
                    {ignored.shows.map((title, index) => (
                      <li key={`show-${index}`}>{title}</li>
                    ))}
                  </ul>
                </>
              )}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
