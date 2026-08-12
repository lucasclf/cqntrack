import type { AuthorBooksResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { BookCard } from "./BookCard";
import styles from "./AuthorDetail.module.css";

type LoadStatus = "loading" | "ready" | "error";

// Sem entrypoint próprio (busca/rota de nível raiz) — só alcançável por
// link de dentro de um livro (BookDetail). Sem cache: busca ao vivo na
// Google Books a cada acesso (ver authors.service.ts no backend). Sem
// estado "não encontrado" — a Google Books não tem um "autor" com ID
// próprio pra não existir; nome sem nenhum livro correspondente só
// devolve uma lista vazia (ver hint abaixo).
export function AuthorDetail() {
  const { name } = useParams<{ name: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<AuthorBooksResponse | null>(null);

  const [trackedName, setTrackedName] = useState(name);
  if (name !== trackedName) {
    setTrackedName(name);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<AuthorBooksResponse>(`/api/books/authors/${encodeURIComponent(name ?? "")}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar o autor. Tente novamente.</p>;
  }

  return (
    <div className={styles.page}>
      <h1>{detail.name}</h1>

      {detail.books.length === 0 ? (
        <p className={styles.hint}>Nenhum outro livro encontrado desse autor.</p>
      ) : (
        <div className={styles.grid}>
          {detail.books.map((book) => (
            <BookCard key={book.googleBooksId} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
