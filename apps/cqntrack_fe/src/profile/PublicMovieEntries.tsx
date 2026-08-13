import {
  MOVIE_STATUSES,
  MOVIE_STATUS_LABELS,
  type MovieStatus,
  type PaginatedMovieEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { PublicLayout } from "../layouts/PublicLayout";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "../movies/MovieCard";
import styles from "./PublicMediaEntries.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

function parseStatus(raw: string | null): MovieStatus | null {
  return raw !== null && (MOVIE_STATUSES as readonly string[]).includes(raw) ? (raw as MovieStatus) : null;
}

// Destino das estatísticas clicáveis do perfil público (ver MovieStats) —
// listagem completa de verdade (paginação por número de página, não
// carrossel), com filtro opcional de status vindo da URL (?status=).
export function PublicMovieEntries() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [searchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedMovieEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  // Volta pra página 1 quando username/status mudam — ajustado durante o
  // render, mesmo padrão já usado em MyMovieEntries/MovieDetail/etc.
  const identityKey = `${username}/${status ?? ""}`;
  const [trackedIdentityKey, setTrackedIdentityKey] = useState(identityKey);
  if (identityKey !== trackedIdentityKey) {
    setTrackedIdentityKey(identityKey);
    setPage(1);
  }

  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);

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

  if (!username) {
    return (
      <PublicLayout>
        <p>Usuário não encontrado.</p>
      </PublicLayout>
    );
  }

  const title = status ? MOVIE_STATUS_LABELS[status] : "Filmes";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PublicLayout>
      <div className={styles.page}>
        <Link to={`/@${username}`} className={styles.back}>
          ← Voltar pro perfil
        </Link>
        <h1>{title}</h1>

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
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
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
    </PublicLayout>
  );
}
