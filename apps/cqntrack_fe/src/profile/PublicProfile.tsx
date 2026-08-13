import type { PublicProfile as PublicProfileDto } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { BookFavoritesSection } from "../books/BookFavoritesSection";
import { FavoritesSection } from "../games/FavoritesSection";
import { PublicLayout } from "../layouts/PublicLayout";
import { ApiError, apiClient } from "../lib/api-client";
import { BookStats } from "./BookStats";
import { GameStats } from "./GameStats";
import { MovieFavorites } from "./MovieFavorites";
import { MovieStats } from "./MovieStats";
import { type ProfileTab, ProfileTabs } from "./ProfileTabs";
import styles from "./PublicProfile.module.css";
import { RecentlyPlayedGames } from "./RecentlyPlayedGames";
import { RecentlyReadBooks } from "./RecentlyReadBooks";
import { RecentlyWatchedMovies } from "./RecentlyWatchedMovies";
import { RecentlyWatchedSeries } from "./RecentlyWatchedSeries";
import { SeriesFavorites } from "./SeriesFavorites";
import { SeriesStats } from "./SeriesStats";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

// Sempre renderiza dentro de PublicLayout, mesmo quando o visitante é o
// próprio dono do perfil — AppShell não tem aba "Perfil" ainda (só o
// dropdown de conta linka pra cá), essa distinção fica pra quando existir.
//
// Conteúdo organizado em abas por mídia (Filmes/Séries/Jogos/Livros, estilo
// Filmow) — cada aba mostra favoritos + recente daquela mídia. Substitui a
// versão anterior, que empilhava as 6 seções (com filme+série favoritos e
// assistidos misturados numa seção só). Listas e marcações completas
// continuam existindo como rotas, só que agora só acessíveis pelo próprio
// usuário logado.
export function PublicProfile() {
  // A rota é "/:handle" (não "/@:username") — react-router não casa texto
  // literal + parâmetro no mesmo segmento, então o "@" vem junto no valor
  // capturado ("@lucas") e é separado aqui. Sem "@" não é um link de
  // perfil válido — trata como não encontrado, mesmo destino de um handle
  // que não existe.
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(username ? "loading" : "not-found");
  const [activeTab, setActiveTab] = useState<ProfileTab>("movies");

  // Reseta assim que o :handle da rota muda — feito durante o render (mesmo
  // padrão já usado em MovieDetail/SeriesDetail/etc. pra "adjusting state
  // when props change"), não dentro do efeito abaixo. Volta pra aba padrão
  // também, senão navegar de um perfil pra outro mantém a aba de antes.
  const [trackedUsername, setTrackedUsername] = useState(username);
  if (username !== trackedUsername) {
    setTrackedUsername(username);
    setLoadStatus(username ? "loading" : "not-found");
    setActiveTab("movies");
  }

  useEffect(() => {
    if (!username) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<PublicProfileDto>(`/api/users/${username}`)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
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
  if (loadStatus === "error" || !profile || !username) {
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
          {profile.image ? (
            <img className={styles.avatar} src={profile.image} alt="" />
          ) : (
            <div className={styles.avatarPlaceholder} aria-hidden="true">
              {profile.displayUsername.charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.headerInfo}>
            <h1>{profile.displayUsername}</h1>
            <p className={styles.handle}>@{profile.username}</p>
            <p className={styles.memberSince}>Membro desde {memberSince}</p>
          </div>
        </header>

        <ProfileTabs active={activeTab} onChange={setActiveTab} />

        <div className={styles.layout}>
          <div className={styles.main}>
            {activeTab === "movies" && (
              <>
                <MovieFavorites username={username} />
                <RecentlyWatchedMovies username={username} />
              </>
            )}
            {activeTab === "series" && (
              <>
                <SeriesFavorites username={username} />
                <RecentlyWatchedSeries username={username} />
              </>
            )}
            {activeTab === "games" && (
              <>
                <FavoritesSection favoritesEndpoint={`/api/users/${username}/games/favorites`} />
                <RecentlyPlayedGames username={username} />
              </>
            )}
            {activeTab === "books" && (
              <>
                <BookFavoritesSection favoritesEndpoint={`/api/users/${username}/books/favorites`} />
                <RecentlyReadBooks username={username} />
              </>
            )}
          </div>

          <aside className={styles.sidebar}>
            {activeTab === "movies" && <MovieStats username={username} />}
            {activeTab === "series" && <SeriesStats username={username} />}
            {activeTab === "games" && <GameStats username={username} />}
            {activeTab === "books" && <BookStats username={username} />}
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}
