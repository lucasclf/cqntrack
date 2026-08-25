import type {
  MangaList,
  MangaListDetail as MangaListDetailDto,
  MangaSummary,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ListFormModal } from "../components/ListFormModal";
import { ApiError, apiClient } from "../lib/api-client";
import { useConfirm } from "../lib/useConfirm";
import { AddMangaSearch } from "./AddMangaSearch";
import { MangaCard } from "./MangaCard";
import styles from "./MangaListDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function MangaListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<MangaListDetailDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<MangaListDetailDto>(`/api/manga-lists/${listId}`)
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

  async function handleRemoveItem(mangadexId: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/api/manga-lists/${listId}/items/${mangadexId}`);
      setDetail((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.mangadexId !== mangadexId),
              itemCount: current.itemCount - 1,
            }
          : current,
      );
    } catch {
      setActionError("Falha ao remover o mangá da lista. Tente novamente.");
    }
  }

  async function handleAddManga(manga: MangaSummary) {
    setActionError(null);
    try {
      await apiClient.put(`/api/manga-lists/${listId}/items/${manga.mangadexId}`);
      setDetail((current) =>
        current && !current.items.some((item) => item.mangadexId === manga.mangadexId)
          ? {
              ...current,
              items: [{ ...manga, entry: null }, ...current.items],
              itemCount: current.itemCount + 1,
            }
          : current,
      );
    } catch {
      setActionError("Falha ao adicionar o mangá à lista. Tente novamente.");
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
    await apiClient.delete(`/api/manga-lists/${listId}`);
    void navigate("/mangas/listas");
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

      <AddMangaSearch
        onAdd={handleAddManga}
        addedIds={new Set(detail.items.map((item) => item.mangadexId))}
      />

      {actionError && <p role="alert">{actionError}</p>}

      {detail.items.length === 0 ? (
        <p className={styles.hint}>Essa lista ainda não tem mangás.</p>
      ) : (
        <div className={styles.grid}>
          {detail.items.map((manga) => (
            <div key={manga.mangadexId} className={styles.gridItem}>
              <MangaCard manga={manga} entry={manga.entry} interactive />
              <button
                type="button"
                className={styles.removeItemBtn}
                onClick={() => handleRemoveItem(manga.mangadexId)}
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
            const updated = await apiClient.patch<MangaList>(`/api/manga-lists/${listId}`, values);
            setDetail((current) => (current ? { ...current, ...updated } : current));
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
