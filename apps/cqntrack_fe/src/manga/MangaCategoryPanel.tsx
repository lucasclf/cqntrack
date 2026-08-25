import type { MangaEntryWithManga } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { MediaSubTabs, type MediaSubTab } from "../components/MediaSubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { MangaCard } from "./MangaCard";

interface MangaCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Aba "Mangás" da Home — favoritos e lido recentemente como 2 sub-abas
// independentes (ver MediaSubTabs), cada uma com sua própria rolagem
// infinita vertical (ver InfiniteMediaGrid). Mesmo padrão de
// BookCategoryPanel.
export function MangaCategoryPanel({ basePath }: MangaCategoryPanelProps) {
  const [subTab, setSubTab] = useState<MediaSubTab>("favorites");

  const favorites = useInfiniteList<MangaEntryWithManga>(
    (page) =>
      `${basePath}/manga/entries?favorite=true&sortBy=favorite&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "favorites",
  );
  const recent = useInfiniteList<MangaEntryWithManga>(
    (page) =>
      `${basePath}/manga/entries?status=read&sortBy=updatedAt&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "recent",
  );

  return (
    <div>
      <MediaSubTabs active={subTab} onChange={setSubTab} recentLabel="Lido recentemente" />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum mangá favoritado ainda."
        errorMessage="Falha ao carregar seus mangás favoritos."
        getKey={(item) => item.manga.mangadexId}
        renderItem={(item) => <MangaCard manga={item.manga} entry={item} interactive />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum mangá lido recentemente."
        errorMessage="Falha ao carregar seus mangás lidos recentemente."
        getKey={(item) => item.manga.mangadexId}
        renderItem={(item) => <MangaCard manga={item.manga} entry={item} interactive />}
      />
    </div>
  );
}
