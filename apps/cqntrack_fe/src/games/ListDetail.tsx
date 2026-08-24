import type { GameList, GameListDetail as GameListDetailDto, GameSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ListFormModal } from "../components/ListFormModal";
import { ApiError, apiClient } from "../lib/api-client";
import { useConfirm } from "../lib/useConfirm";
import { AddGameSearch } from "./AddGameSearch";
import { GameCard } from "./GameCard";
import styles from "./ListDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function ListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<GameListDetailDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<GameListDetailDto>(`/api/lists/${listId}`)
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

  async function handleRemoveItem(igdbId: number) {
    setActionError(null);
    try {
      await apiClient.delete(`/api/lists/${listId}/items/${igdbId}`);
      setDetail((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.igdbId !== igdbId),
              itemCount: current.itemCount - 1,
            }
          : current,
      );
    } catch {
      setActionError("Falha ao remover o jogo da lista. Tente novamente.");
    }
  }

  async function handleAddGame(game: GameSummary) {
    setActionError(null);
    try {
      await apiClient.put(`/api/lists/${listId}/items/${game.igdbId}`);
      setDetail((current) =>
        current && !current.items.some((item) => item.igdbId === game.igdbId)
          ? {
              ...current,
              items: [{ ...game, entry: null }, ...current.items],
              itemCount: current.itemCount + 1,
            }
          : current,
      );
    } catch {
      setActionError("Falha ao adicionar o jogo à lista. Tente novamente.");
    }
  }

  async function handleDeleteList() {
    if (
      !(await confirm({
        message: "Remover esta lista? Essa ação não pode ser desfeita.",
        danger: true,
      }))
    ) {
      return;
    }
    await apiClient.delete(`/api/lists/${listId}`);
    void navigate("/jogos/listas");
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

      <AddGameSearch
        onAdd={handleAddGame}
        addedIds={new Set(detail.items.map((item) => item.igdbId))}
      />

      {actionError && <p role="alert">{actionError}</p>}

      {detail.items.length === 0 ? (
        <p className={styles.hint}>Essa lista ainda não tem jogos.</p>
      ) : (
        <div className={styles.grid}>
          {detail.items.map((game) => (
            <div key={game.igdbId} className={styles.gridItem}>
              <GameCard game={game} entry={game.entry} interactive />
              <button
                type="button"
                className={styles.removeItemBtn}
                onClick={() => handleRemoveItem(game.igdbId)}
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
            const updated = await apiClient.patch<GameList>(`/api/lists/${listId}`, values);
            setDetail((current) => (current ? { ...current, ...updated } : current));
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
