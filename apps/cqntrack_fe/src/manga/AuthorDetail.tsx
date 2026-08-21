import type { AuthorMangaResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError, apiClient } from "../lib/api-client";
import { MangaCard } from "./MangaCard";
import styles from "./AuthorDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

// Sem entrypoint próprio (busca/rota de nível raiz) — só alcançável por
// link de dentro de um mangá (MangaDetail). Sem cache: busca ao vivo na
// MangaDex a cada acesso (ver authors.service.ts no backend). Diferente de
// AuthorDetail de livro: a MangaDex tem um recurso de autor de verdade
// (com ID próprio), então dá pra ter um estado "não encontrado" de verdade
// (id inválido/removido), não só "lista vazia".
export function AuthorDetail() {
  const { authorId } = useParams<{ authorId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<AuthorMangaResponse | null>(null);

  const [trackedAuthorId, setTrackedAuthorId] = useState(authorId);
  if (authorId !== trackedAuthorId) {
    setTrackedAuthorId(authorId);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<AuthorMangaResponse>(`/api/manga/authors/${authorId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Autor não encontrado.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar o autor. Tente novamente.</p>;
  }

  return (
    <div className={styles.page}>
      <h1>{detail.name}</h1>

      {detail.manga.length === 0 ? (
        <p className={styles.hint}>Nenhum outro mangá encontrado desse autor.</p>
      ) : (
        <div className={styles.grid}>
          {detail.manga.map((manga) => (
            <MangaCard key={manga.mangadexId} manga={manga} />
          ))}
        </div>
      )}
    </div>
  );
}
