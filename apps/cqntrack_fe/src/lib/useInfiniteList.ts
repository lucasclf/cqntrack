import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

export type LoadStatus = "loading" | "ready" | "error";

interface PaginatedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
}

interface InfiniteListResult<TItem> {
  items: TItem[];
  total: number | null;
  loadStatus: LoadStatus;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

// Rolagem infinita sobre uma rota paginada por página numérica (mesma
// forma de PaginatedXEntriesResponse já usada em "Minhas marcações", ver
// usePaginatedEntries) — só que ACUMULA os itens de cada página em vez de
// substituir, pra virar uma lista contínua em vez de "página 1/2/3".
//
// `resetKey` identifica o conjunto atual (ex.: qual sub-aba/filtro) — muda
// de identidade, reseta a lista do zero e busca a página 1 de novo. Sem
// isso não teria como saber quando "trocou de lista" vs. "mesma lista,
// carregando mais".
export function useInfiniteList<TItem>(
  buildUrl: (page: number) => string,
  resetKey: string,
): InfiniteListResult<TItem> {
  const [items, setItems] = useState<TItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset durante o render (mesmo padrão de usePaginatedEntries) — permite
  // que o efeito abaixo já dispare buscando a página 1 do conjunto novo,
  // sem uma renderização extra ainda mostrando a lista antiga.
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey);
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey);
    setItems([]);
    setPage(1);
    setPageSize(null);
    setTotal(null);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PaginatedResponse<TItem>>(buildUrl(1))
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setPage(1);
        setPageSize(res.pageSize);
        setTotal(res.total);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // buildUrl muda de identidade a cada render (closure do chamador) — só
    // refazer o fetch quando o conjunto muda de fato (resetKey) é o
    // próprio objetivo, mesmo espírito de usePaginatedEntries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const hasMore = total !== null && pageSize !== null && page * pageSize < total;

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<PaginatedResponse<TItem>>(buildUrl(nextPage));
      setItems((current) => [...current, ...res.items]);
      setPage(nextPage);
      setTotal(res.total);
    } catch {
      // Silencioso — o sentinela continua visível, tenta de novo assim que
      // reabilitar (ver useInfiniteScrollSentinel).
    } finally {
      setLoadingMore(false);
    }
  }

  return { items, total, loadStatus, loadingMore, hasMore, loadMore };
}
