import {
  BOOK_STATUS_LABELS,
  GAME_STATUS_LABELS,
  MOVIE_STATUS_LABELS,
  type ActivityFeedResponse,
  type ActivityItem,
  type BookStatus,
  type GameStatus,
  type MediaType,
  type MovieStatus,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ActivityFeed.module.css";

type LoadStatus = "loading" | "ready" | "error";

// `type`/`metadata` são genéricos entre seções (ver activity.schema.ts no
// backend), mas cada seção tem seu próprio vocabulário de `type` — jogos,
// livros e filmes emitem "status_changed" (são status-based; só série não
// tem status), série emite "season_watched". Como três seções emitem
// "status_changed" com mapas de label diferentes, o case abaixo escolhe o
// mapa certo por `item.mediaType`.
function describeActivity(item: ActivityItem): string {
  const metadata = item.metadata ?? {};
  switch (item.type) {
    case "status_changed": {
      if (item.mediaType === "books") {
        const status = metadata.status as BookStatus | undefined;
        return status ? `Marcou como "${BOOK_STATUS_LABELS[status]}"` : "Mudou o status";
      }
      if (item.mediaType === "movies") {
        const status = metadata.status as MovieStatus | undefined;
        return status ? `Marcou como "${MOVIE_STATUS_LABELS[status]}"` : "Mudou o status";
      }
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
    case "season_watched": {
      const season = metadata.season as number | undefined;
      const episodeCount = metadata.episodeCount as number | undefined;
      return season !== undefined
        ? `Assistiu a temporada ${season}${episodeCount !== undefined ? ` (${episodeCount} episódios)` : ""}`
        : "Assistiu uma temporada inteira";
    }
    case "watched":
      return "Assistiu";
    case "imported": {
      const source = metadata.source as string | undefined;
      const label = source === "filmow" ? "Filmow" : source === "tvtime" ? "tvtime" : "importação";
      return `Importou do ${label}`;
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
