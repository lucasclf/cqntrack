import {
  GAME_STATUSES,
  GAME_STATUS_LABELS,
  type GameStatus,
  type PaginatedGameEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { GameCard } from "../games/GameCard";
import { PublicLayout } from "../layouts/PublicLayout";
import { apiClient } from "../lib/api-client";
import styles from "./PublicMediaEntries.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

function parseStatus(raw: string | null): GameStatus | null {
  return raw !== null && (GAME_STATUSES as readonly string[]).includes(raw) ? (raw as GameStatus) : null;
}

// Destino das estatísticas clicáveis do perfil público (ver GameStats).
export function PublicGameEntries() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [searchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedGameEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  const identityKey = `${username}/${status ?? ""}`;
  const [trackedIdentityKey, setTrackedIdentityKey] = useState(identityKey);
  if (identityKey !== trackedIdentityKey) {
    setTrackedIdentityKey(identityKey);
    setPage(1);
  }

  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);

    apiClient
      .get<PaginatedGameEntriesResponse>(`/api/users/${username}/games/entries?${params}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [username, status, page]);

  if (!username) {
    return (
      <PublicLayout>
        <p>Usuário não encontrado.</p>
      </PublicLayout>
    );
  }

  const title = status ? GAME_STATUS_LABELS[status] : "Jogos";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PublicLayout>
      <div className={styles.page}>
        <Link to={`/@${username}`} className={styles.back}>
          ← Voltar pro perfil
        </Link>
        <h1>{title}</h1>

        {loadStatus === "error" && <p role="alert">Falha ao carregar. Tente novamente.</p>}
        {loadStatus === "ready" && data?.items.length === 0 && (
          <p className={styles.hint}>Nada por aqui ainda.</p>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className={styles.grid}>
              {data.items.map((entry) => (
                <GameCard key={entry.game.igdbId} game={entry.game} entry={entry} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Anterior
                </button>
                <span className={styles.pageInfo}>
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
