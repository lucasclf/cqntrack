import {
  GAME_STATUS_LABELS,
  type ActivityFeedResponse,
  type ActivityItem,
  type GameStatus,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ActivityFeed.module.css";

type LoadStatus = "loading" | "ready" | "error";

// `type`/`metadata` são genéricos entre seções (ver activity.schema.ts no
// backend) — só jogos escreve esses tipos por enquanto, então a descrição
// abaixo ainda é toda games-specific. Quando uma segunda seção existir, cada
// uma passa a ter seu próprio vocabulário de `type` e essa função precisa
// levar `item.mediaType` em conta.
function describeActivity(item: ActivityItem): string {
  const metadata = item.metadata ?? {};
  switch (item.type) {
    case "status_changed": {
      const status = metadata.status as GameStatus | undefined;
      return status ? `Marcou como "${GAME_STATUS_LABELS[status]}"` : "Mudou o status";
    }
    case "favorited":
      return "Favoritou";
    case "rated": {
      const rating = metadata.rating as number | undefined;
      return rating !== undefined ? `Avaliou com ${rating.toFixed(1)} estrelas` : "Avaliou";
    }
    case "reviewed":
      return "Escreveu uma review";
    case "added_to_list": {
      const listName = metadata.listName as string | undefined;
      return listName ? `Adicionou à lista "${listName}"` : "Adicionou a uma lista";
    }
    default:
      return "Atividade";
  }
}

function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Feed de atividade recente do próprio usuário — usado só na home, sem
// outro consumidor (por isso vive junto do Commit que reescreve a Home).
export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<ActivityFeedResponse>("/api/activity")
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setCursor(data.nextCursor);
        setLoadStatus("ready");
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

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await apiClient.get<ActivityFeedResponse>(
        `/api/activity?before=${encodeURIComponent(cursor)}`,
      );
      setItems((current) => [...current, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      // Silencioso — o botão continua visível pro usuário tentar de novo.
    } finally {
      setLoadingMore(false);
    }
  }

  if (loadStatus === "loading") {
    return <p className={styles.hint}>Carregando atividade...</p>;
  }
  if (loadStatus === "error") {
    return <p role="alert">Falha ao carregar sua atividade recente.</p>;
  }
  if (items.length === 0) {
    return <p className={styles.hint}>Nenhuma atividade ainda — busque um jogo pra começar.</p>;
  }

  return (
    <div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <Link to={item.itemHref} className={styles.gameLink}>
              {item.itemCoverUrl && <img className={styles.cover} src={item.itemCoverUrl} alt="" />}
              <div>
                <p className={styles.description}>{describeActivity(item)}</p>
                <p className={styles.gameName}>{item.itemTitle}</p>
                <p className={styles.date}>{formatActivityDate(item.createdAt)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {cursor && (
        <button type="button" className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </div>
  );
}
