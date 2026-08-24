import type { DiscoverMangaResponse, MangaSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { MediaSearchInput } from "../components/MediaSearchInput";
import { apiClient } from "../lib/api-client";
import styles from "./MangaDiscover.module.css";
import { MangaCard } from "./MangaCard";

type LoadStatus = "loading" | "idle" | "error";

// Índice da seção de mangás no menu superior — populares de verdade via
// order[followedCount] da MangaDex (confirmado funcionando durante o
// planejamento), mesmo espírito de MovieDiscover/SeriesDiscover/GameDiscover
// ("carregar mais"). Diferente de livro, que não tem Discover (Google Books
// não suporta popularidade).
export function MangaDiscover() {
  const [results, setResults] = useState<MangaSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra "loading" assim que a página muda (ex.: "Carregar mais") —
  // feito durante o render (mesmo padrão de MovieDiscover), não dentro do
  // efeito abaixo.
  const [trackedPage, setTrackedPage] = useState(page);
  if (page !== trackedPage) {
    setTrackedPage(page);
    setStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<DiscoverMangaResponse>(`/api/manga/discover?page=${page}`)
      .then((data) => {
        if (cancelled) return;
        setResults((current) => (page === 1 ? data.results : [...current, ...data.results]));
        setHasMore(data.hasMore);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className={styles.page}>
      <h1>Descobrir mangás</h1>
      <MediaSearchInput
        sectionPath="/mangas"
        placeholder="Título do mangá..."
        ariaLabel="Buscar mangás"
      />
      {status === "error" && (
        <p role="alert">Falha ao carregar mangás populares. Tente novamente.</p>
      )}

      <div className={styles.grid}>
        {results.map((manga) => (
          <MangaCard key={manga.mangadexId} manga={manga} />
        ))}
      </div>

      {status === "loading" && <p className={styles.hint}>Carregando...</p>}

      {hasMore && status !== "loading" && (
        <div className={styles.loadMore}>
          <button type="button" onClick={() => setPage((current) => current + 1)}>
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
