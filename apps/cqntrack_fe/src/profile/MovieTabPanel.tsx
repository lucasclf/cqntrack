import {
  MOVIE_STATUSES,
  MOVIE_STATUS_LABELS,
  type MovieStatus,
  type PaginatedMovieEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "../movies/MovieCard";
import { MovieFavorites } from "./MovieFavorites";
import { RecentlyWatchedMovies } from "./RecentlyWatchedMovies";
import styles from "./TabPanel.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

function parseStatus(raw: string | null): MovieStatus | null {
  return raw !== null && (MOVIE_STATUSES as readonly string[]).includes(raw)
    ? (raw as MovieStatus)
    : null;
}

// Conteúdo da aba "Filmes" do perfil público — sem status na URL (?status=),
// mostra favoritos + assistido recentemente; com status, mostra a listagem
// completa e paginada daquele status (destino das estatísticas da lateral,
// ver MovieStats). Renderizado via <Outlet/> dentro de PublicProfile — o
// header/abas/lateral nunca desmontam ao trocar de status, só este painel.
export function MovieTabPanel() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [searchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));

  if (!username) {
    return null;
  }

  const basePath = `/api/users/${username}`;

  if (!status) {
    return (
      <>
        <MovieFavorites basePath={basePath} />
        <RecentlyWatchedMovies basePath={basePath} />
      </>
    );
  }

  return <FilteredMovies username={username} status={status} />;
}

interface FilteredMoviesProps {
  username: string;
  status: MovieStatus;
}

function FilteredMovies({ username, status }: FilteredMoviesProps) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedMovieEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  // Volta pra página 1 quando outra estatística é clicada (status muda) —
  // ajustado durante o render, mesmo padrão já usado em MyMovieEntries/etc.
  const [trackedStatus, setTrackedStatus] = useState(status);
  if (status !== trackedStatus) {
    setTrackedStatus(status);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });

    apiClient
      .get<PaginatedMovieEntriesResponse>(`/api/users/${username}/movies/entries?${params}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [username, status, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div className={styles.filterHeader}>
        <h2>{MOVIE_STATUS_LABELS[status]}</h2>
        <Link to={`/@${username}/filmes`} className={styles.clear}>
          Limpar filtro
        </Link>
      </div>

      {loadStatus === "error" && <p role="alert">Falha ao carregar. Tente novamente.</p>}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nada por aqui ainda.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((entry) => (
              <MovieCard key={entry.movie.tmdbId} movie={entry.movie} entry={entry} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
