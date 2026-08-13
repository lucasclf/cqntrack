import type { PublicProfile as PublicProfileDto } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router";
import { PublicLayout } from "../layouts/PublicLayout";
import { ApiError, apiClient } from "../lib/api-client";
import { BookStats } from "./BookStats";
import { GameStats } from "./GameStats";
import { MovieStats } from "./MovieStats";
import { type ProfileTab, ProfileTabs } from "./ProfileTabs";
import styles from "./PublicProfile.module.css";
import { SeriesStats } from "./SeriesStats";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

function tabFromPathname(pathname: string): ProfileTab {
  if (pathname.endsWith("/series")) return "series";
  if (pathname.endsWith("/jogos")) return "games";
  if (pathname.endsWith("/livros")) return "books";
  return "movies";
}

// Casca PERSISTENTE do perfil público (/@:username/...): header (avatar +
// nome), abas por mídia e a lateral de estatísticas continuam montados
// enquanto o visitante navega entre abas ou entre estatísticas filtradas
// (?status=X) — só o conteúdo principal troca, via <Outlet/> (rotas filhas
// em router.tsx: filmes/series/jogos/livros). Antes cada troca de aba
// era só estado local dentro deste componente, o que forçava rebuscar tudo
// (inclusive a lateral) e não dava pra voltar/compartilhar a URL de uma
// aba específica — agora é navegação de verdade, então F5 e o botão
// "voltar" do navegador mantêm a aba certa.
//
// Sempre renderiza dentro de PublicLayout, mesmo quando o visitante é o
// próprio dono do perfil — AppShell não tem aba "Perfil" ainda (só o
// dropdown de conta linka pra cá), essa distinção fica pra quando existir.
export function PublicProfile() {
  // A rota é "/:handle" (não "/@:username") — react-router não casa texto
  // literal + parâmetro no mesmo segmento, então o "@" vem junto no valor
  // capturado ("@lucas") e é separado aqui. Sem "@" não é um link de
  // perfil válido — trata como não encontrado, mesmo destino de um handle
  // que não existe.
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const location = useLocation();
  const activeTab = tabFromPathname(location.pathname);

  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(username ? "loading" : "not-found");

  // Reseta assim que o :handle da rota muda — feito durante o render (mesmo
  // padrão já usado em MovieDetail/SeriesDetail/etc. pra "adjusting state
  // when props change"), não dentro do efeito abaixo.
  const [trackedUsername, setTrackedUsername] = useState(username);
  if (username !== trackedUsername) {
    setTrackedUsername(username);
    setLoadStatus(username ? "loading" : "not-found");
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

        <ProfileTabs sectionPrefix={`/@${username}`} />

        <div className={styles.layout}>
          <div className={styles.main}>
            <Outlet />
          </div>

          <aside className={styles.sidebar}>
            {activeTab === "movies" && (
              <MovieStats basePath={`/api/users/${username}`} linkBase={`/@${username}/filmes`} />
            )}
            {activeTab === "series" && (
              <SeriesStats
                basePath={`/api/users/${username}`}
                linkTo={`/@${username}/series?view=all`}
              />
            )}
            {activeTab === "games" && (
              <GameStats basePath={`/api/users/${username}`} linkBase={`/@${username}/jogos`} />
            )}
            {activeTab === "books" && (
              <BookStats basePath={`/api/users/${username}`} linkBase={`/@${username}/livros`} />
            )}
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}
