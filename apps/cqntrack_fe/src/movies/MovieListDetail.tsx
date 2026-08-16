import type {
  MovieList,
  MovieListDetail as MovieListDetailDto,
  MovieSummary,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ListFormModal } from "../components/ListFormModal";
import { ApiError, apiClient } from "../lib/api-client";
import { AddMovieSearch } from "./AddMovieSearch";
import styles from "./MovieListDetail.module.css";
import { MovieCard } from "./MovieCard";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function MovieListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MovieListDetailDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<MovieListDetailDto>(`/api/movies-lists/${listId}`)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setLoadStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  async function handleRemoveItem(tmdbId: number) {
    setActionError(null);
    try {
      await apiClient.delete(`/api/movies-lists/${listId}/items/${tmdbId}`);
      setDetail((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.tmdbId !== tmdbId),
              itemCount: current.itemCount - 1,
            }
          : current,
      );
    } catch {
      setActionError("Falha ao remover o filme da lista. Tente novamente.");
    }
  }

  async function handleAddMovie(movie: MovieSummary) {
    setActionError(null);
    try {
      await apiClient.put(`/api/movies-lists/${listId}/items/${movie.tmdbId}`);
      setDetail((current) =>
        current && !current.items.some((item) => item.tmdbId === movie.tmdbId)
          ? { ...current, items: [movie, ...current.items], itemCount: current.itemCount + 1 }
          : current,
      );
    } catch {
      setActionError("Falha ao adicionar o filme à lista. Tente novamente.");
    }
  }

  async function handleDeleteList() {
    if (!window.confirm("Remover esta lista? Essa ação não pode ser desfeita.")) {
      return;
    }
    await apiClient.delete(`/api/movies-lists/${listId}`);
    void navigate("/filmes/listas");
  }

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Lista não encontrada.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar a lista. Tente novamente.</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>{detail.name}</h1>
          {detail.description && <p className={styles.description}>{detail.description}</p>}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => setEditModalOpen(true)}>
            Editar
          </button>
          <button type="button" className={styles.deleteBtn} onClick={handleDeleteList}>
            Remover lista
          </button>
        </div>
      </div>

      <AddMovieSearch
        onAdd={handleAddMovie}
        addedIds={new Set(detail.items.map((item) => item.tmdbId))}
      />

      {actionError && <p role="alert">{actionError}</p>}

      {detail.items.length === 0 ? (
        <p className={styles.hint}>Essa lista ainda não tem filmes.</p>
      ) : (
        <div className={styles.grid}>
          {detail.items.map((movie) => (
            <div key={movie.tmdbId} className={styles.gridItem}>
              <MovieCard movie={movie} />
              <button
                type="button"
                className={styles.removeItemBtn}
                onClick={() => handleRemoveItem(movie.tmdbId)}
              >
                Remover da lista
              </button>
            </div>
          ))}
        </div>
      )}

      {editModalOpen && (
        <ListFormModal
          mode="edit"
          initialValues={{ name: detail.name, description: detail.description }}
          onSubmit={async (values) => {
            const updated = await apiClient.patch<MovieList>(`/api/movies-lists/${listId}`, values);
            setDetail((current) => (current ? { ...current, ...updated } : current));
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
