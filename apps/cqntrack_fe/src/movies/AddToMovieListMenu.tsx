import type { MovieList, MovieListsResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import styles from "./AddToMovieListMenu.module.css";

interface AddToMovieListMenuProps {
  tmdbId: number;
}

// Dropdown simples pra adicionar o filme a uma das listas do usuário. Não
// mostra em quais listas o filme já está (não existe endpoint pra isso
// ainda); só marca com ✓ as listas em que o clique nesta sessão já
// confirmou a adição — adicionar de novo é idempotente no backend de
// qualquer forma.
export function AddToMovieListMenu({ tmdbId }: AddToMovieListMenuProps) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MovieList[] | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || lists !== null) {
      return;
    }
    apiClient
      .get<MovieListsResponse>("/api/movies-lists")
      .then((data) => setLists(data.lists))
      .catch(() => setError("Falha ao carregar suas listas."));
  }, [open, lists]);

  async function handleAdd(listId: string) {
    setError(null);
    try {
      await apiClient.put(`/api/movies-lists/${listId}/items/${tmdbId}`);
      setAddedIds((current) => new Set(current).add(listId));
      setOpen(false);
    } catch {
      setError("Falha ao adicionar o filme à lista.");
    }
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((current) => !current)}>
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
        </div>
      )}
    </div>
  );
}
