import type { MovieEntryWithMovie } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { MediaSubTabs, type MediaSubTab } from "../components/MediaSubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { MovieCard } from "./MovieCard";

interface MovieCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Aba "Filmes" da Home — favoritos e assistido recentemente como 2
// sub-abas independentes (ver MediaSubTabs), cada uma com sua própria
// rolagem infinita vertical (ver InfiniteMediaGrid). Reaproveita a rota
// paginada que "Meus filmes" já usa (favorite=true&sortBy=favorite pra
// favoritos, status=watched&sortBy=updatedAt pra recentes) — nenhuma rota
// nova no backend.
export function MovieCategoryPanel({ basePath }: MovieCategoryPanelProps) {
  const [subTab, setSubTab] = useState<MediaSubTab>("favorites");

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
      <MediaSubTabs active={subTab} onChange={setSubTab} recentLabel="Assistido recentemente" />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum filme favoritado ainda."
        errorMessage="Falha ao carregar seus filmes favoritos."
        getKey={(item) => item.movie.tmdbId}
        renderItem={(item) => <MovieCard movie={item.movie} entry={item} />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum filme assistido recentemente."
        errorMessage="Falha ao carregar seus filmes assistidos recentemente."
        getKey={(item) => item.movie.tmdbId}
        renderItem={(item) => <MovieCard movie={item.movie} entry={item} />}
      />
    </div>
  );
}
