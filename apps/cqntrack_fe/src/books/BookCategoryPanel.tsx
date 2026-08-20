import type { BookEntryWithBook } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { MediaSubTabs, type MediaSubTab } from "../components/MediaSubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { BookCard } from "./BookCard";

interface BookCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Aba "Livros" da Home — favoritos e lido recentemente como 2 sub-abas
// independentes (ver MediaSubTabs), cada uma com sua própria rolagem
// infinita vertical (ver InfiniteMediaGrid).
export function BookCategoryPanel({ basePath }: BookCategoryPanelProps) {
  const [subTab, setSubTab] = useState<MediaSubTab>("favorites");

  const favorites = useInfiniteList<BookEntryWithBook>(
    (page) =>
      `${basePath}/books/entries?favorite=true&sortBy=favorite&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "favorites",
  );
  const recent = useInfiniteList<BookEntryWithBook>(
    (page) =>
      `${basePath}/books/entries?status=read&sortBy=updatedAt&order=desc&page=${page}&pageSize=${PAGE_SIZE}`,
    "recent",
  );

  return (
    <div>
      <MediaSubTabs active={subTab} onChange={setSubTab} recentLabel="Lido recentemente" />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum livro favoritado ainda."
        errorMessage="Falha ao carregar seus livros favoritos."
        getKey={(item) => item.book.googleBooksId}
        renderItem={(item) => <BookCard book={item.book} entry={item} />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum livro lido recentemente."
        errorMessage="Falha ao carregar seus livros lidos recentemente."
        getKey={(item) => item.book.googleBooksId}
        renderItem={(item) => <BookCard book={item.book} entry={item} />}
      />
    </div>
  );
}
