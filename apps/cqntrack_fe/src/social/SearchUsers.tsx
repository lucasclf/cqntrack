import type { FollowedUser, PaginatedUsersResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { FollowButton } from "./FollowButton";
import styles from "./SearchUsers.module.css";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type LoadStatus = "loading" | "idle" | "error";

// Aba "Procurar" da Social — diretório de outros usuários do app (nunca o
// próprio viewer, resolvido no backend), com campo de busca opcional por
// username/nome. Paginação "Carregar mais" manual (mesmo padrão dos
// *Discover.tsx) — mais parecido com "lista navegável com filtro de
// texto" do que rolagem infinita ou paginação por página.
export function SearchUsers() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<FollowedUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra página 1 e reseta o status assim que a busca muda — feito
  // durante o render (mesmo padrão de *Discover.tsx/*Search.tsx pra
  // "adjusting state when props change"), não dentro do efeito abaixo.
  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  const [trackedPage, setTrackedPage] = useState(page);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setTrackedPage(1);
    setPage(1);
    setStatus("loading");
  } else if (page !== trackedPage) {
    setTrackedPage(page);
    setStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedQuery) params.set("q", debouncedQuery);

    apiClient
      .get<PaginatedUsersResponse>(`/api/social/search?${params}`)
      .then((data) => {
        if (cancelled) return;
        setResults((current) => (page === 1 ? data.items : [...current, ...data.items]));
        setTotal(data.total);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedQuery]);

  const hasMore = results.length < total;

  return (
    <div>
      <input
        type="search"
        className={styles.input}
        placeholder="Buscar por username ou nome..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar usuários"
      />

      {status === "error" && <p role="alert">Falha ao buscar usuários. Tente novamente.</p>}
      {status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum usuário encontrado.</p>
      )}

      <ul className={styles.list}>
        {results.map((item) => (
          <li key={item.username} className={styles.item}>
            <Link to={`/@${item.username}`} className={styles.link}>
              {item.image ? (
                <img className={styles.avatar} src={item.image} alt="" />
              ) : (
                <div className={styles.avatarPlaceholder} aria-hidden="true">
                  {item.displayUsername.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={styles.name}>{item.displayUsername}</span>
            </Link>
            <FollowButton username={item.username} />
          </li>
        ))}
      </ul>

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
