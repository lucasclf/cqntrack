import type { FollowedUser, FollowingResponse } from "@cqntrack/shared";
import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError, apiClient } from "../lib/api-client";
import { FriendActivityFeed } from "./FriendActivityFeed";
import styles from "./FriendsPage.module.css";

type LoadStatus = "loading" | "ready" | "error";

// Tela "Amigos" (/amigos) — busca por username pra seguir, lista de quem
// eu sigo (com deixar de seguir) e o feed de atividade deles (ver
// FriendActivityFeed.tsx). Sem tela de busca de usuário dedicada — seguir
// por username direto já é suficiente pro escopo "algo simples" pedido.
export function FriendsPage() {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  const [searchUsername, setSearchUsername] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Incrementado a cada follow/unfollow bem-sucedido — vira a `key` do
  // FriendActivityFeed abaixo, forçando ele a remontar e rebuscar (mesmo
  // padrão de "reset trocando a key" já usado em ActivityTab.tsx). Sem
  // isso, seguir alguém não atualizava o feed: ele já tinha carregado (e
  // ficado vazio) antes do follow acontecer, e seu único fetch é on-mount.
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  function loadFollowing() {
    return apiClient.get<FollowingResponse>("/api/social/following").then((data) => {
      setFollowing(data.items);
      setLoadStatus("ready");
    });
  }

  useEffect(() => {
    let cancelled = false;
    loadFollowing().catch(() => {
      if (!cancelled) setLoadStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFollow(event: FormEvent) {
    event.preventDefault();
    const username = searchUsername.trim();
    if (!username) return;

    setSearchPending(true);
    setSearchError(null);
    try {
      await apiClient.put(`/api/social/follow/${username}`);
      setSearchUsername("");
      await loadFollowing();
      setFeedRefreshKey((current) => current + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setSearchError("Usuário não encontrado.");
      } else if (error instanceof ApiError && error.status === 400) {
        setSearchError("Você não pode seguir a si mesmo.");
      } else {
        setSearchError("Falha ao seguir. Tente novamente.");
      }
    } finally {
      setSearchPending(false);
    }
  }

  async function handleUnfollow(username: string) {
    setFollowing((current) => current.filter((item) => item.username !== username));
    try {
      await apiClient.delete(`/api/social/follow/${username}`);
      setFeedRefreshKey((current) => current + 1);
    } catch {
      // Falhou — recarrega a lista de verdade em vez de deixar o estado
      // local mentir que deixou de seguir quando na real não deixou.
      await loadFollowing().catch(() => {});
    }
  }

  return (
    <div className={styles.page}>
      <h1>Amigos</h1>

      <form className={styles.searchForm} onSubmit={handleFollow}>
        <input
          type="text"
          value={searchUsername}
          onChange={(event) => setSearchUsername(event.target.value)}
          placeholder="Username de quem você quer seguir"
          className={styles.searchInput}
        />
        <button type="submit" disabled={searchPending || !searchUsername.trim()}>
          Seguir
        </button>
      </form>
      {searchError && (
        <p role="alert" className={styles.searchError}>
          {searchError}
        </p>
      )}

      <section className={styles.section}>
        <h2>Quem você segue</h2>
        {loadStatus === "loading" && <p className={styles.hint}>Carregando...</p>}
        {loadStatus === "error" && (
          <p role="alert">Falha ao carregar sua lista de amigos. Tente novamente.</p>
        )}
        {loadStatus === "ready" && following.length === 0 && (
          <p className={styles.hint}>Você ainda não segue ninguém.</p>
        )}
        <ul className={styles.followingList}>
          {following.map((item) => (
            <li key={item.username} className={styles.followingItem}>
              <Link to={`/@${item.username}`} className={styles.followingLink}>
                {item.image ? (
                  <img className={styles.avatar} src={item.image} alt="" />
                ) : (
                  <div className={styles.avatarPlaceholder} aria-hidden="true">
                    {item.displayUsername.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>{item.displayUsername}</span>
              </Link>
              <button
                type="button"
                className={styles.unfollowBtn}
                onClick={() => handleUnfollow(item.username)}
              >
                Deixar de seguir
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Atividade dos amigos</h2>
        <FriendActivityFeed key={feedRefreshKey} />
      </section>
    </div>
  );
}
