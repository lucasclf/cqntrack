import type { RecentlyWatchedSeriesItem, SeriesEntryWithSeries } from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { SubTabs } from "../components/SubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { SeriesCard } from "./SeriesCard";
import { SeriesDiscover } from "./SeriesDiscover";

type SeriesSubTab = "favorites" | "recent" | "discover";

const TABS = [
  { key: "favorites" as const, label: "Favoritos" },
  { key: "recent" as const, label: "Assistido recentemente" },
  { key: "discover" as const, label: "Descobrir" },
];

interface SeriesCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Painel da seção "Séries" (rota /series) — 3 sub-abas: favoritos e
// assistido recentemente com rolagem infinita própria (ver
// InfiniteMediaGrid), mais Descobrir, que embute SeriesDiscover como
// estava (antes era a rota índice da seção, ver router.tsx). Série não tem
// status (ver ListSeriesEntriesQuerySchema) — "assistido recentemente" usa
// a rota dedicada /series/recently-watched (MAX(watchedAt) por série) em
// vez de /series/entries?status=..., diferente de filmes/jogos/livros.
export function SeriesCategoryPanel({ basePath }: SeriesCategoryPanelProps) {
  // Aba inicial é "discover" se a URL já chega com `?q=` — acontece ao
  // voltar de uma série aberta a partir de uma busca dentro do Descobrir
  // (ver SeriesDiscover.tsx, que espelha a busca em `?q=`): sem isso,
  // voltar reabriria sempre em Favoritos, perdendo a busca de vista.
  const [searchParams] = useSearchParams();
  const [subTab, setSubTab] = useState<SeriesSubTab>(() =>
    searchParams.get("q") ? "discover" : "favorites",
  );

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
      <SubTabs tabs={TABS} active={subTab} onChange={setSubTab} />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhuma série favoritada ainda."
        errorMessage="Falha ao carregar suas séries favoritas."
        getKey={(item) => item.series.tmdbId}
        renderItem={(item) => <SeriesCard series={item.series} entry={item} interactive />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhuma série assistida recentemente."
        errorMessage="Falha ao carregar suas séries assistidas recentemente."
        getKey={(item) => item.series.tmdbId}
        renderItem={(item) => <SeriesCard series={item.series} />}
      />
      {subTab === "discover" && <SeriesDiscover />}
    </div>
  );
}
