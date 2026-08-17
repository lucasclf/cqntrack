import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { apiClient } from "./api-client";

export type LoadStatus = "loading" | "ready" | "error";

// Busca paginada com filtros, compartilhada pelas telas "Minhas marcações"
// (games/movies/series/books) — eram 4 cópias quase idênticas dessa mesma
// máquina de estados (busca + paginação + reset de página ao mudar filtro),
// ver histórico do repo.
//
// `filters` é qualquer valor serializável representando os filtros atuais
// (sem a página) — comparado via JSON.stringify pra saber quando resetar
// pra página 1. O reset acontece durante o render (não dentro do efeito,
// mesmo padrão que já existia nos 4 arquivos antes dessa extração): permite
// que o efeito de busca já dispare com a página certa, sem uma renderização
// extra buscando a página antiga.
export function usePaginatedEntries<T extends { total: number; pageSize: number }>(
  buildUrl: (page: number) => string,
  filters: unknown,
): {
  data: T | null;
  loadStatus: LoadStatus;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
} {
  const [page, setPage] = useState(1);

  const filtersKey = JSON.stringify(filters);
  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const [data, setData] = useState<T | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<T>(buildUrl(page))
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
    // buildUrl muda de identidade a cada render (closure sobre os filtros do
    // chamador) — refazer o fetch só quando filtersKey/page mudam de fato é
    // o próprio objetivo (mesmo espírito das dependências explícitas que
    // cada tela tinha antes, uma por filtro).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return { data, loadStatus, page, setPage, totalPages };
}
