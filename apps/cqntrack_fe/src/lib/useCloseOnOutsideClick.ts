import { type RefObject, useEffect } from "react";

// Fecha um menu/dropdown aberto ao clicar fora dele ou apertar Esc —
// compartilhado pelos 4 "Adicionar a uma lista" (games/movies/series/books),
// que antes só fechavam re-clicando no botão que abriu ou depois de uma
// ação bem-sucedida (ficavam abertos cobrindo o resto da tela se o usuário
// clicasse em qualquer outro lugar).
export function useCloseOnOutsideClick(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, isOpen, onClose]);
}
