import type { ActivityFeedResponse, ActivityItem, MediaType } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { describeActivity, formatActivityDate } from "../activity/describeActivity";
import { apiClient } from "../lib/api-client";
import styles from "./ActivityFeed.module.css";

type LoadStatus = "loading" | "ready" | "error";

interface ActivityFeedProps {
  // Filtra o feed por seção (aba "Atividades" da home) — ausente mostra
  // todas. O pai deve trocar a `key` do componente quando o filtro muda
  // (em vez de reagir a uma prop instável aqui), pra reaproveitar o mesmo
  // reset "remonta do zero" já usado noutras trocas de identidade no app.
  mediaType?: MediaType;
}

// Feed de atividade recente do próprio usuário — usado só na home, sem
// outro consumidor (por isso vive junto do Commit que reescreve a Home).
export function ActivityFeed({ mediaType }: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = mediaType ? `?mediaType=${mediaType}` : "";

    apiClient
      .get<ActivityFeedResponse>(`/api/activity${query}`)
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
  }, [mediaType]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ before: cursor });
      if (mediaType) params.set("mediaType", mediaType);
      const data = await apiClient.get<ActivityFeedResponse>(`/api/activity?${params}`);
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
    return <p className={styles.hint}>Nenhuma atividade por aqui ainda.</p>;
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
