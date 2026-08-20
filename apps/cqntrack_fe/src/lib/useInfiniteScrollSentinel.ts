import { type RefObject, useEffect, useRef } from "react";

// Observa um elemento sentinela (renderizado no fim de uma lista) e chama
// `onLoadMore` quando ele entra na viewport — dispensa listener de scroll
// manual/debounce. `rootMargin` com folga já dispara um pouco antes do
// fim literal da lista, pra não deixar o usuário ver um "piscar" de
// carregando bem na borda. `enabled` deve ser false enquanto já está
// carregando ou não há mais página (evita disparo repetido enquanto o
// sentinela permanece visível).
export function useInfiniteScrollSentinel(
  onLoadMore: () => void,
  enabled: boolean,
): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  // Mantém a ref atualizada fora do render (regra react-hooks/refs) — o
  // observer abaixo só é recriado quando `enabled` muda, então sem isso ele
  // ficaria preso na closure de `onLoadMore` da primeira vez que montou.
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [enabled]);

  return sentinelRef;
}
