import type { MangaEntryWithManga } from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { SubTabs } from "../components/SubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { MangaCard } from "./MangaCard";
import { MangaDiscover } from "./MangaDiscover";

type MangaSubTab = "favorites" | "recent" | "discover";

const TABS = [
  { key: "favorites" as const, label: "Favoritos" },
  { key: "recent" as const, label: "Lido recentemente" },
  { key: "discover" as const, label: "Descobrir" },
];

interface MangaCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Painel da seção "Mangás" (rota /mangas) — 3 sub-abas: favoritos e lido
// recentemente com rolagem infinita própria (ver InfiniteMediaGrid), mais
// Descobrir, que embute MangaDiscover como estava (antes era a rota índice
// da seção, ver router.tsx). Mesmo padrão de BookCategoryPanel.
export function MangaCategoryPanel({ basePath }: MangaCategoryPanelProps) {
  // Aba inicial é "discover" se a URL já chega com `?q=` — acontece ao
  // voltar de um mangá aberto a partir de uma busca dentro do Descobrir
  // (ver MangaDiscover.tsx, que espelha a busca em `?q=`): sem isso,
  // voltar reabriria sempre em Favoritos, perdendo a busca de vista.
  const [searchParams] = useSearchParams();
  const [subTab, setSubTab] = useState<MangaSubTab>(() =>
    searchParams.get("q") ? "discover" : "favorites",
  );

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
      <SubTabs tabs={TABS} active={subTab} onChange={setSubTab} />

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
      {subTab === "discover" && <MangaDiscover />}
    </div>
  );
}
