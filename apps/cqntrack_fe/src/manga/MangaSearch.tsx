import type { MangaSummaryWithEntry, SearchMangaResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { MangaCard } from "./MangaCard";
import styles from "./MangaSearch.module.css";

const SEARCH_DEBOUNCE_MS = 300;

type SearchStatus = "idle" | "loading" | "error";

export function MangaSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<MangaSummaryWithEntry[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");

  // Ajusta o status assim que a query debounced muda — feito durante o
  // render (padrão recomendado pelo React pra "adjusting state when props
  // change"), não dentro do efeito, que fica só com a chamada assíncrona.
  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setStatus(debouncedQuery ? "loading" : "idle");
    if (!debouncedQuery) {
      setResults([]);
    }
  }

  // Espelha a query pra URL (?q=), pra sobreviver a navegação e dar ao botão
  // "Voltar" um resultado pra restaurar (ver BackButton). Precisa ser um
  // efeito, não o bloco de ajuste acima: setSearchParams atualiza o estado
  // do RouterProvider (um componente diferente), chamar isso durante o
  // render do MangaSearch dispara o aviso do React "Cannot update a
  // component while rendering a different component" (bug real, achado
  // testando ao vivo — ver skill browser-smoke-test).
  useEffect(() => {
    setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true });
  }, [debouncedQuery, setSearchParams]);

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<SearchMangaResponse>(`/api/manga/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((data) => {
        if (!cancelled) {
          setResults(data.results);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasQuery = debouncedQuery !== "";

  return (
    <div className={styles.page}>
      <h1>Buscar mangás</h1>
      <input
        type="search"
        className={styles.input}
        placeholder="Título do mangá..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar mangás"
      />
      {hasQuery && status === "error" && (
        <p role="alert">Falha ao buscar mangás. Tente novamente.</p>
      )}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum mangá encontrado para &quot;{debouncedQuery}&quot;.</p>
      )}
      <div className={styles.grid}>
        {results.map((manga) => (
          <MangaCard key={manga.mangadexId} manga={manga} entry={manga.entry} interactive />
        ))}
      </div>
    </div>
  );
}
