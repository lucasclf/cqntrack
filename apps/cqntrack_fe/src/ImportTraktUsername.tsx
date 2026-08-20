import type {
  ImportTraktMoviesResponse,
  ImportTraktShowResponse,
  TraktMoviesPreviewResponse,
  TraktShowsPreviewResponse,
} from "@cqntrack/shared";
import { type FormEvent, useState } from "react";
import styles from "./ImportTraktUsername.module.css";
import { ApiError, apiClient } from "./lib/api-client";

// Lote de filmes por request — o tmdb_id já vem resolvido pelo Trakt (sem
// busca por texto na TMDB, diferente do Filmow), então cada item custa bem
// menos CPU; mesmo teto de ImportTraktMoviesRequestSchema (10), por
// consistência com o Filmow.
const MOVIE_BATCH_SIZE = 10;

type Phase = "idle" | "loading" | "importing-movies" | "importing-series" | "done" | "error";

interface MovieOutcome {
  title: string;
  status: "imported" | "not_found" | "error";
}

interface SeriesOutcome {
  title: string;
  status: "imported" | "not_found" | "error";
  episodesImported: number;
}

// "Conta" > "Importar dados" > Trakt (só perfil público) — diferente de
// Filmow/tvtime, não tem CSV: o backend já consulta a API do Trakt pelo
// username (ver /api/movies|series/import/trakt) e devolve a lista pronta
// pra importar, com tmdb_id resolvido. Roda em 2 fases sequenciais (filmes
// em lote, depois séries 1 por request) — mesmo espírito de barra de
// progresso que ImportFilmowCsv/ImportTvTimeCsv já usam.
export function ImportTraktUsername() {
  const [username, setUsername] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [movieProgress, setMovieProgress] = useState({ done: 0, total: 0 });
  const [seriesProgress, setSeriesProgress] = useState({ done: 0, total: 0 });
  const [movieResults, setMovieResults] = useState<MovieOutcome[]>([]);
  const [seriesResults, setSeriesResults] = useState<SeriesOutcome[]>([]);

  async function importMovies(preview: TraktMoviesPreviewResponse) {
    const collected: MovieOutcome[] = preview.notFound.map((item) => ({
      title: item.title,
      status: "not_found",
    }));
    setMovieResults([...collected]);
    setMovieProgress({ done: 0, total: preview.importable.length });

    for (let start = 0; start < preview.importable.length; start += MOVIE_BATCH_SIZE) {
      const batch = preview.importable.slice(start, start + MOVIE_BATCH_SIZE);
      try {
        const response = await apiClient.post<ImportTraktMoviesResponse>(
          "/api/movies/import/trakt",
          {
            items: batch.map((item) => ({
              tmdbId: item.tmdbId,
              title: item.title,
              rating: item.rating,
            })),
          },
        );
        collected.push(...response.results);
      } catch {
        for (const item of batch) {
          collected.push({ title: item.title, status: "error" });
        }
      }
      setMovieProgress({
        done: Math.min(start + MOVIE_BATCH_SIZE, preview.importable.length),
        total: preview.importable.length,
      });
      setMovieResults([...collected]);
    }

    // Resumo agregado, não 1 por filme (import roda com logActivity: false,
    // ver import.service.ts no backend). Melhor esforço: falha aqui não
    // trava a tela de resultado.
    const importedCount = collected.filter((r) => r.status === "imported").length;
    if (importedCount > 0) {
      apiClient.post("/api/movies/import/trakt/activity", { importedCount }).catch(() => {});
    }
  }

  async function importSeries(preview: TraktShowsPreviewResponse) {
    const collected: SeriesOutcome[] = preview.notFound.map((item) => ({
      title: item.title,
      status: "not_found",
      episodesImported: 0,
    }));
    setSeriesResults([...collected]);
    setSeriesProgress({ done: 0, total: preview.importable.length });

    for (const show of preview.importable) {
      try {
        const response = await apiClient.post<ImportTraktShowResponse>("/api/series/import/trakt", {
          tmdbId: show.tmdbId,
          title: show.title,
          rating: show.rating,
          episodes: show.episodes,
        });
        collected.push(response);
      } catch {
        collected.push({ title: show.title, status: "error", episodesImported: 0 });
      }
      setSeriesProgress((current) => ({
        done: current.done + 1,
        total: preview.importable.length,
      }));
      setSeriesResults([...collected]);
    }

    const importedSeriesCount = collected.filter((r) => r.status === "imported").length;
    const importedEpisodeCount = collected.reduce((sum, r) => sum + r.episodesImported, 0);
    if (importedSeriesCount > 0) {
      apiClient
        .post("/api/series/import/trakt/activity", { importedSeriesCount, importedEpisodeCount })
        .catch(() => {});
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    setError(null);
    setPhase("loading");
    setMovieResults([]);
    setSeriesResults([]);

    let moviesPreview: TraktMoviesPreviewResponse;
    let seriesPreview: TraktShowsPreviewResponse;
    try {
      [moviesPreview, seriesPreview] = await Promise.all([
        apiClient.get<TraktMoviesPreviewResponse>(
          `/api/movies/import/trakt?username=${encodeURIComponent(trimmed)}`,
        ),
        apiClient.get<TraktShowsPreviewResponse>(
          `/api/series/import/trakt?username=${encodeURIComponent(trimmed)}`,
        ),
      ]);
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof ApiError && err.status === 404
          ? "Não conseguimos acessar esse perfil do Trakt. Confira o nome de usuário e se o histórico está público (Configurações > Privacidade, no Trakt)."
          : "Falha ao consultar o Trakt. Tente novamente.",
      );
      return;
    }

    setPhase("importing-movies");
    await importMovies(moviesPreview);
    setPhase("importing-series");
    await importSeries(seriesPreview);
    setPhase("done");
  }

  const busy = phase === "loading" || phase === "importing-movies" || phase === "importing-series";
  const importedMovies = movieResults.filter((r) => r.status === "imported").length;
  const importedSeries = seriesResults.filter((r) => r.status === "imported").length;
  const totalEpisodes = seriesResults.reduce(
    (sum, r) => sum + (r.status === "imported" ? r.episodesImported : 0),
    0,
  );
  const notFoundMovies = movieResults.filter((r) => r.status === "not_found");
  const erroredMovies = movieResults.filter((r) => r.status === "error");
  const notFoundSeries = seriesResults.filter((r) => r.status === "not_found");
  const erroredSeries = seriesResults.filter((r) => r.status === "error");

  return (
    <div className={styles.card}>
      <h3>Filmes e séries assistidos (Trakt)</h3>
      <p className={styles.hint}>
        Só funciona com o histórico do Trakt público (Configurações &gt; Privacidade, no próprio
        Trakt). Filmes e séries assistidos entram como "Já vi", com a nota convertida quando você
        tiver avaliado no Trakt.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="seu_usuario_no_trakt"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !username.trim()}>
          {busy ? "Importando..." : "Importar"}
        </button>
      </form>

      {phase === "loading" && <p className={styles.hint}>Consultando o Trakt...</p>}
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
            {totalEpisodes === 1 ? "episódio marcado" : "episódios marcados"}) como "Já vi".
          </p>

          {erroredMovies.length > 0 && (
            <div role="alert">
              <p>
                {erroredMovies.length}{" "}
                {erroredMovies.length === 1 ? "filme falhou" : "filmes falharam"} ao importar.
              </p>
            </div>
          )}
          {notFoundMovies.length > 0 && (
            <details>
              <summary>
                {notFoundMovies.length}{" "}
                {notFoundMovies.length === 1 ? "filme sem tmdb_id" : "filmes sem tmdb_id"} no Trakt
              </summary>
              <ul className={styles.notFoundList}>
                {notFoundMovies.map((result, index) => (
                  <li key={`${result.title}-${index}`}>{result.title}</li>
                ))}
              </ul>
            </details>
          )}

          {erroredSeries.length > 0 && (
            <div role="alert">
              <p>
                {erroredSeries.length}{" "}
                {erroredSeries.length === 1 ? "série falhou" : "séries falharam"} ao importar.
              </p>
            </div>
          )}
          {notFoundSeries.length > 0 && (
            <details>
              <summary>
                {notFoundSeries.length}{" "}
                {notFoundSeries.length === 1 ? "série sem tmdb_id" : "séries sem tmdb_id"} no Trakt
              </summary>
              <ul className={styles.notFoundList}>
                {notFoundSeries.map((result, index) => (
                  <li key={`${result.title}-${index}`}>{result.title}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
