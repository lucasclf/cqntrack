import type { BookList, BookListDetail as BookListDetailDto, BookSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ListFormModal } from "../components/ListFormModal";
import { ApiError, apiClient } from "../lib/api-client";
import { AddBookSearch } from "./AddBookSearch";
import { BookCard } from "./BookCard";
import styles from "./BookListDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function BookListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<BookListDetailDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BookListDetailDto>(`/api/books-lists/${listId}`)
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

  async function handleRemoveItem(googleBooksId: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/api/books-lists/${listId}/items/${googleBooksId}`);
      setDetail((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.googleBooksId !== googleBooksId),
              itemCount: current.itemCount - 1,
            }
          : current,
      );
    } catch {
      setActionError("Falha ao remover o livro da lista. Tente novamente.");
    }
  }

  async function handleAddBook(book: BookSummary) {
    setActionError(null);
    try {
      await apiClient.put(`/api/books-lists/${listId}/items/${book.googleBooksId}`);
      setDetail((current) =>
        current && !current.items.some((item) => item.googleBooksId === book.googleBooksId)
          ? { ...current, items: [book, ...current.items], itemCount: current.itemCount + 1 }
          : current,
      );
    } catch {
      setActionError("Falha ao adicionar o livro à lista. Tente novamente.");
    }
  }

  async function handleDeleteList() {
    if (!window.confirm("Remover esta lista? Essa ação não pode ser desfeita.")) {
      return;
    }
    await apiClient.delete(`/api/books-lists/${listId}`);
    void navigate("/livros/listas");
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

      <AddBookSearch
        onAdd={handleAddBook}
        addedIds={new Set(detail.items.map((item) => item.googleBooksId))}
      />

      {actionError && <p role="alert">{actionError}</p>}

      {detail.items.length === 0 ? (
        <p className={styles.hint}>Essa lista ainda não tem livros.</p>
      ) : (
        <div className={styles.grid}>
          {detail.items.map((book) => (
            <div key={book.googleBooksId} className={styles.gridItem}>
              <BookCard book={book} />
              <button
                type="button"
                className={styles.removeItemBtn}
                onClick={() => handleRemoveItem(book.googleBooksId)}
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
            const updated = await apiClient.patch<BookList>(`/api/books-lists/${listId}`, values);
            setDetail((current) => (current ? { ...current, ...updated } : current));
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
