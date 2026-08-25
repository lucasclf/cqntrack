import type { MovieEntryWithMovie } from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { SubTabs } from "../components/SubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { MovieCard } from "./MovieCard";
import { MovieDiscover } from "./MovieDiscover";

type MovieSubTab = "favorites" | "recent" | "discover";

const TABS = [
  { key: "favorites" as const, label: "Favoritos" },
  { key: "recent" as const, label: "Assistido recentemente" },
  { key: "discover" as const, label: "Descobrir" },
];

interface MovieCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Painel da seção "Filmes" (rota /filmes) — 3 sub-abas: favoritos e
// assistido recentemente com rolagem infinita própria (ver
// InfiniteMediaGrid), mais Descobrir, que embute MovieDiscover como estava
// (antes era a rota índice da seção, ver router.tsx). Reaproveita a rota
// paginada que "Meus filmes" já usa (favorite=true&sortBy=favorite pra
// favoritos, status=watched&sortBy=updatedAt pra recentes) — nenhuma rota
// nova no backend.
export function MovieCategoryPanel({ basePath }: MovieCategoryPanelProps) {
  // Aba inicial é "discover" se a URL já chega com `?q=` — acontece ao
  // voltar de um filme aberto a partir de uma busca dentro do Descobrir
  // (ver MovieDiscover.tsx, que espelha a busca em `?q=`): sem isso,
  // voltar reabriria sempre em Favoritos, perdendo a busca de vista.
  const [searchParams] = useSearchParams();
  const [subTab, setSubTab] = useState<MovieSubTab>(() =>
    searchParams.get("q") ? "discover" : "favorites",
  );

  const favorites = useInfiniteList<MovieEntryWithMovie>(
    (page) =>
      `${basePath}/movies/entries?favorite=true&sortBy=favorite&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "favorites",
  );
  const recent = useInfiniteList<MovieEntryWithMovie>(
    (page) =>
      `${basePath}/movies/entries?status=watched&sortBy=updatedAt&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "recent",
  );

  return (
    <div>
      <SubTabs tabs={TABS} active={subTab} onChange={setSubTab} />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum filme favoritado ainda."
        errorMessage="Falha ao carregar seus filmes favoritos."
        getKey={(item) => item.movie.tmdbId}
        renderItem={(item) => <MovieCard movie={item.movie} entry={item} interactive />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum filme assistido recentemente."
        errorMessage="Falha ao carregar seus filmes assistidos recentemente."
        getKey={(item) => item.movie.tmdbId}
        renderItem={(item) => <MovieCard movie={item.movie} entry={item} interactive />}
      />
      {subTab === "discover" && <MovieDiscover />}
    </div>
  );
}
