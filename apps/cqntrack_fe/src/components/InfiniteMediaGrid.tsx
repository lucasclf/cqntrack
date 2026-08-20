import { Fragment, type ReactNode } from "react";
import type { LoadStatus } from "../lib/useInfiniteList";
import { useInfiniteScrollSentinel } from "../lib/useInfiniteScrollSentinel";
import styles from "./InfiniteMediaGrid.module.css";

interface InfiniteListState<TItem> {
  items: TItem[];
  loadStatus: LoadStatus;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

interface InfiniteMediaGridProps<TItem> {
  // Fica montado mesmo quando não é a sub-aba ativa (ver MovieCategoryPanel
  // e afins) — só escondido via `hidden`, pro fetch da página 1 já rodar
  // desde a montagem (mesmo espírito das abas da Home). `hidden` também
  // impede o sentinela de disparar (elemento com display:none nunca
  // "intersecta"), então não precisa de lógica extra pra isso.
  hidden: boolean;
  state: InfiniteListState<TItem>;
  emptyMessage: string;
  errorMessage: string;
  getKey: (item: TItem) => string | number;
  renderItem: (item: TItem) => ReactNode;
}

// Grade vertical com rolagem infinita (12 em 12, ver useInfiniteList) —
// reaproveitada pelas 4 seções de mídia da Home (séries/filmes/jogos/
// livros), tanto pra favoritos quanto pra "assistido recentemente". Troca
// o antigo carrossel horizontal (ver MixedMediaGrid.module.css) só aqui;
// esse continua em uso no perfil público, que não muda.
export function InfiniteMediaGrid<TItem>({
  hidden,
  state,
  emptyMessage,
  errorMessage,
  getKey,
  renderItem,
}: InfiniteMediaGridProps<TItem>) {
  const sentinelRef = useInfiniteScrollSentinel(
    state.loadMore,
    state.loadStatus === "ready" && state.hasMore && !state.loadingMore,
  );

  return (
    <div hidden={hidden}>
      {state.loadStatus === "loading" && <p className={styles.hint}>Carregando...</p>}
      {state.loadStatus === "error" && <p role="alert">{errorMessage}</p>}
      {state.loadStatus === "ready" && state.items.length === 0 && (
        <p className={styles.hint}>{emptyMessage}</p>
      )}

      {state.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {state.items.map((item) => (
              <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
            ))}
          </div>
          {state.hasMore && (
            <div ref={sentinelRef} className={styles.sentinel}>
              {state.loadingMore && <p className={styles.hint}>Carregando mais...</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
