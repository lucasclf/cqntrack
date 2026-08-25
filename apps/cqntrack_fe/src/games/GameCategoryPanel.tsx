import type { GameEntryWithGame } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { SubTabs } from "../components/SubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { GameCard } from "./GameCard";
import { GameDiscover } from "./GameDiscover";

type GameSubTab = "favorites" | "recent" | "discover";

const TABS = [
  { key: "favorites" as const, label: "Favoritos" },
  { key: "recent" as const, label: "Jogado recentemente" },
  { key: "discover" as const, label: "Descobrir" },
];

interface GameCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Painel da seção "Jogos" (rota /jogos) — 3 sub-abas: favoritos e jogado
// recentemente com rolagem infinita própria (ver InfiniteMediaGrid), mais
// Descobrir, que embute GameDiscover como estava (antes era a rota índice
// da seção, ver router.tsx). "Jogado" cobre vários status de uma vez
// (playing/dropped/completed/platinum, nunca not_started) — usa
// excludeNotStarted=true em vez de status=X (ver ListGameEntriesQuerySchema).
export function GameCategoryPanel({ basePath }: GameCategoryPanelProps) {
  const [subTab, setSubTab] = useState<GameSubTab>("favorites");

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
      <SubTabs tabs={TABS} active={subTab} onChange={setSubTab} />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum jogo favoritado ainda."
        errorMessage="Falha ao carregar seus jogos favoritos."
        getKey={(item) => item.game.igdbId}
        renderItem={(item) => <GameCard game={item.game} entry={item} interactive />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum jogo jogado recentemente."
        errorMessage="Falha ao carregar seus jogos jogados recentemente."
        getKey={(item) => item.game.igdbId}
        renderItem={(item) => <GameCard game={item.game} entry={item} interactive />}
      />
      {subTab === "discover" && <GameDiscover />}
    </div>
  );
}
