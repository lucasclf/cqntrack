import {
  BOOK_STATUS_LABELS,
  GAME_STATUS_LABELS,
  MOVIE_STATUS_LABELS,
  type ActivityItem,
  type BookStatus,
  type GameStatus,
  type MovieStatus,
} from "@cqntrack/shared";

// `type`/`metadata` são genéricos entre seções (ver activity.schema.ts no
// backend), mas cada seção tem seu próprio vocabulário de `type` — jogos,
// livros e filmes emitem "status_changed" (são status-based; só série não
// tem status), série emite "season_watched". Como três seções emitem
// "status_changed" com mapas de label diferentes, o case abaixo escolhe o
// mapa certo por `item.mediaType`.
//
// Extraído de games/ActivityFeed.tsx pra ser reaproveitado pelo feed de
// amigos (social/FriendActivityFeed.tsx) — mesmo vocabulário de atividade,
// só muda quem é o autor exibido.
export function describeActivity(item: ActivityItem): string {
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
    case "series_completed": {
      const seasonCount = metadata.seasonCount as number | undefined;
      return seasonCount !== undefined
        ? `Assistiu a série inteira (${seasonCount} temporada${seasonCount === 1 ? "" : "s"})`
        : "Assistiu a série inteira";
    }
    case "manga_completed":
      return "Leu o mangá inteiro";
    case "imported": {
      const source = metadata.source as string | undefined;
      const label = source === "filmow" ? "Filmow" : source === "tvtime" ? "tvtime" : "importação";
      return `Importou do ${label}`;
    }
    default:
      return "Atividade";
  }
}

export function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
