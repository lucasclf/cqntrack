import type { DiscoverMoviesResponse, MovieSummaryWithEntry } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { MediaSearchInput } from "../components/MediaSearchInput";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "./MovieCard";
import styles from "./MovieDiscover.module.css";

type LoadStatus = "loading" | "idle" | "error";

// Aba "Descobrir" de MovieCategoryPanel — populares da própria TMDB (GET
// /movie/popular), "carregar mais" em vez de paginação com número de
// página (a TMDB não devolve um total útil pra mostrar "página X de Y").
// Sem <h1> próprio: sempre embutido dentro da seção, nunca mais uma rota
// própria.
export function MovieDiscover() {
  const [results, setResults] = useState<MovieSummaryWithEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra "loading" assim que a página muda (ex.: "Carregar mais") —
  // feito durante o render (mesmo padrão já usado em MovieDetail/etc. pra
  // "adjusting state when props change"), não dentro do efeito abaixo.
  const [trackedPage, setTrackedPage] = useState(page);
  if (page !== trackedPage) {
    setTrackedPage(page);
    setStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<DiscoverMoviesResponse>(`/api/movies/discover?page=${page}`)
      .then((data) => {
        if (cancelled) return;
        setResults((current) => (page === 1 ? data.results : [...current, ...data.results]));
        setHasMore(data.hasMore);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className={styles.page}>
      <MediaSearchInput
        sectionPath="/filmes"
        placeholder="Nome do filme..."
        ariaLabel="Buscar filmes"
      />
      {status === "error" && (
        <p role="alert">Falha ao carregar filmes populares. Tente novamente.</p>
      )}

      <div className={styles.grid}>
        {results.map((movie) => (
          <MovieCard key={movie.tmdbId} movie={movie} entry={movie.entry} interactive />
        ))}
      </div>

      {status === "loading" && <p className={styles.hint}>Carregando...</p>}

      {hasMore && status !== "loading" && (
        <div className={styles.loadMore}>
          <button type="button" onClick={() => setPage((current) => current + 1)}>
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
