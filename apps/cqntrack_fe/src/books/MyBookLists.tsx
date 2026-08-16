import type { BookList, BookListsResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ListFormModal } from "../components/ListFormModal";
import { apiClient } from "../lib/api-client";
import styles from "./MyBookLists.module.css";

type LoadStatus = "loading" | "ready" | "error";

export function MyBookLists() {
  const [lists, setLists] = useState<BookList[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BookListsResponse>("/api/books-lists")
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
    await apiClient.delete(`/api/books-lists/${listId}`);
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
      {loadStatus === "error" && (
        <p role="alert">Falha ao carregar suas listas. Tente novamente.</p>
      )}
      {loadStatus === "ready" && lists.length === 0 && (
        <p className={styles.hint}>Você ainda não criou nenhuma lista.</p>
      )}

      <ul className={styles.list}>
        {lists.map((list) => (
          <li key={list.id} className={styles.card}>
            <Link to={`/livros/listas/${list.id}`} className={styles.cardLink}>
              <span className={styles.name}>{list.name}</span>
              <span className={styles.count}>{list.itemCount} livro(s)</span>
              {list.description && <p className={styles.description}>{list.description}</p>}
            </Link>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => handleDelete(list.id)}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <ListFormModal
          mode="create"
          onSubmit={async (values) => {
            const created = await apiClient.post<BookList>("/api/books-lists", values);
            setLists((current) => [created, ...current]);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
