import type { BookList, BookListsResponse } from "@cqntrack/shared";
import { useEffect, useRef, useState } from "react";
import { ListFormModal, type ListFormValues } from "../components/ListFormModal";
import { apiClient } from "../lib/api-client";
import { useCloseOnOutsideClick } from "../lib/useCloseOnOutsideClick";
import styles from "./AddToBookListMenu.module.css";

interface AddToBookListMenuProps {
  googleBooksId: string;
}

// Dropdown simples pra adicionar o livro a uma das listas do usuário. Não
// mostra em quais listas o livro já está (não existe endpoint pra isso
// ainda); só marca com ✓ as listas em que o clique nesta sessão já
// confirmou a adição — adicionar de novo é idempotente no backend de
// qualquer forma. "+ Nova lista" cria e já adiciona o livro nela, sem
// precisar sair daqui pra ir em "Minhas listas" primeiro.
export function AddToBookListMenu({ googleBooksId }: AddToBookListMenuProps) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<BookList[] | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(wrapperRef, open, () => setOpen(false));

  useEffect(() => {
    if (!open || lists !== null) {
      return;
    }
    apiClient
      .get<BookListsResponse>("/api/books-lists")
      .then((data) => setLists(data.lists))
      .catch(() => setError("Falha ao carregar suas listas."));
  }, [open, lists]);

  async function handleAdd(listId: string) {
    setError(null);
    try {
      await apiClient.put(`/api/books-lists/${listId}/items/${googleBooksId}`);
      setAddedIds((current) => new Set(current).add(listId));
      setOpen(false);
    } catch {
      setError("Falha ao adicionar o livro à lista.");
    }
  }

  async function handleCreateAndAdd(values: ListFormValues) {
    const created = await apiClient.post<BookList>("/api/books-lists", values);
    setLists((current) => [created, ...(current ?? [])]);
    await handleAdd(created.id);
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((current) => !current)}
      >
        Adicionar a uma lista
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {error && <p role="alert">{error}</p>}
          {lists === null && !error && <p className={styles.hint}>Carregando...</p>}
          {lists?.length === 0 && <p className={styles.hint}>Você ainda não tem listas.</p>}
          {lists?.map((list) => (
            <button
              key={list.id}
              type="button"
              className={styles.option}
              disabled={addedIds.has(list.id)}
              onClick={() => handleAdd(list.id)}
            >
              {addedIds.has(list.id) ? `✓ ${list.name}` : list.name}
            </button>
          ))}
          <button type="button" className={styles.option} onClick={() => setCreateModalOpen(true)}>
            + Nova lista
          </button>
        </div>
      )}
      {createModalOpen && (
        <ListFormModal
          mode="create"
          onSubmit={handleCreateAndAdd}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </div>
  );
}
