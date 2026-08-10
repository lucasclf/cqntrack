import type { GameList, GameListsResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { gamesClient } from "../lib/games-client";
import { ListFormModal } from "./ListFormModal";
import styles from "./MyLists.module.css";

type LoadStatus = "loading" | "ready" | "error";

export function MyLists() {
  const [lists, setLists] = useState<GameList[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    gamesClient
      .get<GameListsResponse>("/api/lists")
      .then((data) => {
        if (!cancelled) {
          setLists(data.lists);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(listId: string) {
    if (!window.confirm("Remover esta lista? Essa ação não pode ser desfeita.")) {
      return;
    }
    await gamesClient.delete(`/api/lists/${listId}`);
    setLists((current) => current.filter((list) => list.id !== listId));
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Minhas listas</h1>
        <button type="button" onClick={() => setModalOpen(true)}>
          Nova lista
        </button>
      </div>

      {loadStatus === "loading" && <p className={styles.hint}>Carregando...</p>}
      {loadStatus === "error" && <p role="alert">Falha ao carregar suas listas. Tente novamente.</p>}
      {loadStatus === "ready" && lists.length === 0 && (
        <p className={styles.hint}>Você ainda não criou nenhuma lista.</p>
      )}

      <ul className={styles.list}>
        {lists.map((list) => (
          <li key={list.id} className={styles.card}>
            <Link to={`/listas/${list.id}`} className={styles.cardLink}>
              <span className={styles.name}>{list.name}</span>
              <span className={styles.count}>{list.itemCount} jogo(s)</span>
              {list.description && <p className={styles.description}>{list.description}</p>}
            </Link>
            <button type="button" className={styles.deleteBtn} onClick={() => handleDelete(list.id)}>
              Remover
            </button>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <ListFormModal
          mode="create"
          onSubmit={async (values) => {
            const created = await gamesClient.post<GameList>("/api/lists", values);
            setLists((current) => [created, ...current]);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
