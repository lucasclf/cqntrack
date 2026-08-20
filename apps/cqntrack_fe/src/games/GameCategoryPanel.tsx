import type { GameEntryWithGame } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { MediaSubTabs, type MediaSubTab } from "../components/MediaSubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { GameCard } from "./GameCard";

interface GameCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Aba "Jogos" da Home — favoritos e jogado recentemente como 2 sub-abas
// independentes (ver MediaSubTabs), cada uma com sua própria rolagem
// infinita vertical (ver InfiniteMediaGrid). "Jogado" cobre vários status
// de uma vez (playing/dropped/completed/platinum, nunca not_started) — usa
// excludeNotStarted=true em vez de status=X (ver ListGameEntriesQuerySchema).
export function GameCategoryPanel({ basePath }: GameCategoryPanelProps) {
  const [subTab, setSubTab] = useState<MediaSubTab>("favorites");

  const favorites = useInfiniteList<GameEntryWithGame>(
    (page) =>
      `${basePath}/games/entries?favorite=true&sortBy=favorite&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "favorites",
  );
  const recent = useInfiniteList<GameEntryWithGame>(
    (page) =>
      `${basePath}/games/entries?excludeNotStarted=true&sortBy=updatedAt&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "recent",
  );

  return (
    <div>
      <MediaSubTabs active={subTab} onChange={setSubTab} recentLabel="Jogado recentemente" />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum jogo favoritado ainda."
        errorMessage="Falha ao carregar seus jogos favoritos."
        getKey={(item) => item.game.igdbId}
        renderItem={(item) => <GameCard game={item.game} entry={item} />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum jogo jogado recentemente."
        errorMessage="Falha ao carregar seus jogos jogados recentemente."
        getKey={(item) => item.game.igdbId}
        renderItem={(item) => <GameCard game={item.game} entry={item} />}
      />
    </div>
  );
}
