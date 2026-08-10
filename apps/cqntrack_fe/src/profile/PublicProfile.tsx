import type {
  GameListsResponse,
  PaginatedGameEntriesResponse,
  PublicProfile as PublicProfileDto,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { FavoritesSection } from "../games/FavoritesSection";
import { GameCard } from "../games/GameCard";
import { PublicLayout } from "../layouts/PublicLayout";
import { ApiError, apiClient } from "../lib/api-client";
import styles from "./PublicProfile.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

// Sempre renderiza dentro de PublicLayout, mesmo quando o visitante é o
// próprio dono do perfil — AppShell não tem aba "Perfil" ainda, então essa
// distinção (prevista no plano original) fica pra quando essa aba existir.
export function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [entries, setEntries] = useState<PaginatedGameEntriesResponse | null>(null);
  const [lists, setLists] = useState<GameListsResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiClient.get<PublicProfileDto>(`/api/users/${username}`),
      apiClient.get<PaginatedGameEntriesResponse>(`/api/users/${username}/entries`),
      apiClient.get<GameListsResponse>(`/api/users/${username}/lists`),
    ])
      .then(([profileData, entriesData, listsData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setEntries(entriesData);
        setLists(listsData);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loadStatus === "loading") {
    return (
      <PublicLayout>
        <p>Carregando...</p>
      </PublicLayout>
    );
  }
  if (loadStatus === "not-found") {
    return (
      <PublicLayout>
        <p>Usuário não encontrado.</p>
      </PublicLayout>
    );
  }
  if (loadStatus === "error" || !profile || !entries || !lists) {
    return (
      <PublicLayout>
        <p role="alert">Falha ao carregar o perfil. Tente novamente.</p>
      </PublicLayout>
    );
  }

  const memberSince = new Date(profile.memberSince).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <PublicLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>{profile.displayUsername}</h1>
          <p className={styles.handle}>@{profile.username}</p>
          <p className={styles.memberSince}>Desde {memberSince}</p>
        </header>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Total</dt>
            <dd>{profile.stats.total}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Jogando</dt>
            <dd>{profile.stats.playing}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Finalizados</dt>
            <dd>{profile.stats.completed}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Platinados</dt>
            <dd>{profile.stats.platinum}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Favoritos</dt>
            <dd>{profile.stats.favorites}</dd>
          </div>
        </dl>

        <FavoritesSection favoritesEndpoint={`/api/users/${username}/favorites`} />

        {lists.lists.length > 0 && (
          <section>
            <h2>Listas</h2>
            <ul className={styles.listNames}>
              {lists.lists.map((list) => (
                <li key={list.id}>
                  <Link to={`/u/${username}/listas/${list.id}`}>
                    {list.name} <span className={styles.listCount}>({list.itemCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>Marcações</h2>
          {entries.items.length === 0 ? (
            <p className={styles.hint}>Nenhuma marcação ainda.</p>
          ) : (
            <div className={styles.grid}>
              {entries.items.map((item) => (
                <GameCard key={item.game.igdbId} game={item.game} entry={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}
