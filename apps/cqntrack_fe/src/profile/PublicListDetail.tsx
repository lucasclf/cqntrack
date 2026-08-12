import type { GameListDetail } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { GameCard } from "../games/GameCard";
import { PublicLayout } from "../layouts/PublicLayout";
import { ApiError, apiClient } from "../lib/api-client";
import styles from "./PublicListDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function PublicListDetail() {
  // Mesmo motivo de PublicProfile: a rota é "/:handle/listas/:listId", não
  // "/@:username/...", porque react-router não casa texto literal +
  // parâmetro no mesmo segmento — separa o "@" aqui.
  const { handle, listId } = useParams<{ handle: string; listId: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [detail, setDetail] = useState<GameListDetail | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(username ? "loading" : "not-found");

  // Reseta assim que o :handle/:listId da rota muda — feito durante o
  // render (mesmo padrão de PublicProfile), não dentro do efeito abaixo.
  const [trackedKey, setTrackedKey] = useState(`${username}/${listId}`);
  const currentKey = `${username}/${listId}`;
  if (currentKey !== trackedKey) {
    setTrackedKey(currentKey);
    setLoadStatus(username ? "loading" : "not-found");
  }

  useEffect(() => {
    if (!username) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<GameListDetail>(`/api/users/${username}/games/lists/${listId}`)
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
  }, [username, listId]);

  if (loadStatus === "loading") {
    return (
      <PublicLayout>
        <p>Carregando...</p>
      </PublicLayout>
    );
  }
  if (loadStatus === "not-found") {
    return (
      <PublicLayout>
        <p>Lista não encontrada.</p>
      </PublicLayout>
    );
  }
  if (loadStatus === "error" || !detail) {
    return (
      <PublicLayout>
        <p role="alert">Falha ao carregar a lista. Tente novamente.</p>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <Link to={`/@${username}`} className={styles.backLink}>
            ← Voltar pro perfil de @{username}
          </Link>
          <h1>{detail.name}</h1>
          {detail.description && <p className={styles.description}>{detail.description}</p>}
        </header>

        {detail.items.length === 0 ? (
          <p className={styles.hint}>Essa lista ainda não tem jogos.</p>
        ) : (
          <div className={styles.grid}>
            {detail.items.map((game) => (
              <GameCard key={game.igdbId} game={game} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
