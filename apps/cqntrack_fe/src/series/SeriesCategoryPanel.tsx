import type { RecentlyWatchedSeriesItem, SeriesEntryWithSeries } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { MediaSubTabs, type MediaSubTab } from "../components/MediaSubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { SeriesCard } from "./SeriesCard";

interface SeriesCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Aba "Séries" da Home — favoritos e assistido recentemente como 2
// sub-abas independentes (ver MediaSubTabs), cada uma com sua própria
// rolagem infinita vertical (ver InfiniteMediaGrid). Série não tem status
// (ver ListSeriesEntriesQuerySchema) — "assistido recentemente" usa a rota
// dedicada /series/recently-watched (MAX(watchedAt) por série) em vez de
// /series/entries?status=..., diferente de filmes/jogos/livros.
export function SeriesCategoryPanel({ basePath }: SeriesCategoryPanelProps) {
  const [subTab, setSubTab] = useState<MediaSubTab>("favorites");

  const favorites = useInfiniteList<SeriesEntryWithSeries>(
    (page) =>
      `${basePath}/series/entries?favorite=true&sortBy=favorite&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "favorites",
  );
  const recent = useInfiniteList<RecentlyWatchedSeriesItem>(
    (page) => `${basePath}/series/recently-watched?page=${page}&pageSize=${PAGE_SIZE}`,
    "recent",
  );

  return (
    <div>
      <MediaSubTabs active={subTab} onChange={setSubTab} recentLabel="Assistido recentemente" />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhuma série favoritada ainda."
        errorMessage="Falha ao carregar suas séries favoritas."
        getKey={(item) => item.series.tmdbId}
        renderItem={(item) => <SeriesCard series={item.series} entry={item} />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhuma série assistida recentemente."
        errorMessage="Falha ao carregar suas séries assistidas recentemente."
        getKey={(item) => item.series.tmdbId}
        renderItem={(item) => <SeriesCard series={item.series} />}
      />
    </div>
  );
}
