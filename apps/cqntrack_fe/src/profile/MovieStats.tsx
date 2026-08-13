import {
  MOVIE_STATUSES,
  MOVIE_STATUS_LABELS,
  type PaginatedMovieEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ProfileStats.module.css";

interface MovieStatsProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmo componente serve os dois, só troca o prefixo das
  // chamadas de contagem.
  basePath: string;
  // Base do link de cada estatística — "/@username/filmes" (perfil público,
  // ver MovieTabPanel) ou "/filmes/marcacoes" (home, tela de marcações já
  // existente, que lê ?status= como filtro inicial).
  linkBase: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Uma contagem por status (pageSize=1 só pra ler `total`, sem baixar os
// itens) — cada linha é clicável e leva pra listagem completa filtrada.
export function MovieStats({ basePath, linkBase }: MovieStatsProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      MOVIE_STATUSES.map((status) =>
        apiClient
          .get<PaginatedMovieEntriesResponse>(
            `${basePath}/movies/entries?status=${status}&pageSize=1`,
          )
          .then((res) => [status, res.total] as const),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        setCounts(Object.fromEntries(entries));
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [basePath]);

  if (loadStatus !== "ready" || !counts) {
    return null;
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Estatísticas</h2>
      <ul className={styles.list}>
        {MOVIE_STATUSES.map((status) => (
          <li key={status}>
            <Link to={`${linkBase}?status=${status}`} className={styles.stat}>
              <span>{MOVIE_STATUS_LABELS[status]}</span>
              <span className={styles.statCount}>{counts[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
