import type { FriendActivityFeedResponse, FriendActivityItem } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { describeActivity, formatActivityDate } from "../activity/describeActivity";
import { apiClient } from "../lib/api-client";
import styles from "./FriendActivityFeed.module.css";

type LoadStatus = "loading" | "ready" | "error";

// Clone estrutural de games/ActivityFeed.tsx (mesmo padrão de cursor/
// loadMore) — não generalizado num componente só porque o de amigos
// precisa exibir o autor de cada item (várias pessoas no mesmo feed), o
// pessoal não. Mesma decisão já tomada no backend (listFriendActivity
// clonado de listActivity, não parametrizado).
export function FriendActivityFeed() {
  const [items, setItems] = useState<FriendActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<FriendActivityFeedResponse>("/api/social/feed")
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
      const data = await apiClient.get<FriendActivityFeedResponse>(
        `/api/social/feed?before=${encodeURIComponent(cursor)}`,
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
    return <p className={styles.hint}>Carregando atividade dos amigos...</p>;
  }
  if (loadStatus === "error") {
    return <p role="alert">Falha ao carregar a atividade dos seus amigos.</p>;
  }
  if (items.length === 0) {
    return (
      <p className={styles.hint}>
        Nenhuma atividade por aqui ainda — siga alguém pra ver o que anda fazendo.
      </p>
    );
  }

  return (
    <div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <Link to={`/@${item.author.username}`} className={styles.author}>
              {item.author.image ? (
                <img className={styles.authorAvatar} src={item.author.image} alt="" />
              ) : (
                <div className={styles.authorAvatarPlaceholder} aria-hidden="true">
                  {item.author.displayUsername.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={styles.authorName}>{item.author.displayUsername}</span>
            </Link>
            <Link to={item.itemHref} className={styles.itemLink}>
              {item.itemCoverUrl && <img className={styles.cover} src={item.itemCoverUrl} alt="" />}
              <div>
                <p className={styles.description}>{describeActivity(item)}</p>
                <p className={styles.itemTitle}>{item.itemTitle}</p>
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
