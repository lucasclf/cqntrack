import type { BookEntryWithBook } from "@cqntrack/shared";
import { useState } from "react";
import { InfiniteMediaGrid } from "../components/InfiniteMediaGrid";
import { SubTabs } from "../components/SubTabs";
import { useInfiniteList } from "../lib/useInfiniteList";
import { BookCard } from "./BookCard";
import { BookSearch } from "./BookSearch";

type BookSubTab = "favorites" | "recent" | "discover";

const TABS = [
  { key: "favorites" as const, label: "Favoritos" },
  { key: "recent" as const, label: "Lido recentemente" },
  { key: "discover" as const, label: "Descobrir" },
];

interface BookCategoryPanelProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmas rotas de sempre, só reaproveitadas com paginação.
  basePath: string;
}

const PAGE_SIZE = 12;

// Painel da seção "Livros" (rota /livros) — 3 sub-abas: favoritos e lido
// recentemente com rolagem infinita própria (ver InfiniteMediaGrid), mais
// Descobrir. Livros não tem endpoint de "populares" (Google Books não
// oferece isso) — a aba Descobrir embute BookSearch diretamente (mesmo
// componente que também serve a rota /livros/buscar sem mudança nenhuma).
export function BookCategoryPanel({ basePath }: BookCategoryPanelProps) {
  const [subTab, setSubTab] = useState<BookSubTab>("favorites");

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
      <SubTabs tabs={TABS} active={subTab} onChange={setSubTab} />

      <InfiniteMediaGrid
        hidden={subTab !== "favorites"}
        state={favorites}
        emptyMessage="Nenhum livro favoritado ainda."
        errorMessage="Falha ao carregar seus livros favoritos."
        getKey={(item) => item.book.googleBooksId}
        renderItem={(item) => <BookCard book={item.book} entry={item} interactive />}
      />
      <InfiniteMediaGrid
        hidden={subTab !== "recent"}
        state={recent}
        emptyMessage="Nenhum livro lido recentemente."
        errorMessage="Falha ao carregar seus livros lidos recentemente."
        getKey={(item) => item.book.googleBooksId}
        renderItem={(item) => <BookCard book={item.book} entry={item} interactive />}
      />
      {subTab === "discover" && <BookSearch />}
    </div>
  );
}
