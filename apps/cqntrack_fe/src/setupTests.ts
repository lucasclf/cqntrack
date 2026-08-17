import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Rotas carregadas sob demanda (ver router.tsx) somam um import() assíncrono
// real à navegação — sob carga paralela de vários arquivos de teste rodando
// juntos, isso ocasionalmente passa do timeout padrão de 1000ms do
// findBy*/waitFor, tornando testes que navegam entre rotas intermitentes.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
