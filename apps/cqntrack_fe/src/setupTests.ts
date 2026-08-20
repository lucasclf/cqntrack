import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Rotas carregadas sob demanda (ver router.tsx) somam um import() assíncrono
// real à navegação — sob carga paralela de vários arquivos de teste rodando
// juntos, isso ocasionalmente passa do timeout padrão de 1000ms do
// findBy*/waitFor, tornando testes que navegam entre rotas intermitentes.
configure({ asyncUtilTimeout: 5000 });

// jsdom não implementa IntersectionObserver (usado por
// useInfiniteScrollSentinel, ver lib/) — stub global no-op só pra montar
// sem quebrar. Testes que precisam simular "sentinela entrou na viewport"
// capturam a instância e chamam o callback manualmente (ver
// ContinueWatching.test.tsx).
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = (): IntersectionObserverEntry[] => [];
  constructor(public callback: IntersectionObserverCallback) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

afterEach(() => {
  cleanup();
});
