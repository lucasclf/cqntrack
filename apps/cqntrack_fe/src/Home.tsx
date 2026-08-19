import { useState } from "react";
import { ActivityTab } from "./ActivityTab";
import { BookFavoritesSection } from "./books/BookFavoritesSection";
import { FavoritesSection } from "./games/FavoritesSection";
import styles from "./Home.module.css";
import { HomeTabs, type HomeTab } from "./HomeTabs";
import { BookStats } from "./profile/BookStats";
import { GameStats } from "./profile/GameStats";
import { MovieFavorites } from "./profile/MovieFavorites";
import { MovieStats } from "./profile/MovieStats";
import { RecentlyPlayedGames } from "./profile/RecentlyPlayedGames";
import { RecentlyReadBooks } from "./profile/RecentlyReadBooks";
import { RecentlyWatchedMovies } from "./profile/RecentlyWatchedMovies";
import { ContinueWatching } from "./series/ContinueWatching";

const BASE_PATH = "/api";

// Home reformulada: em primeiro lugar, "o que assistir a seguir"
// (ContinueWatching — séries com episódio pendente de verdade, ver
// series_watch_progress) e atividades recentes (ActivityTab, reaproveitado
// tal como já existia). O conteúdo de favoritos/recentes/estatísticas de
// Filmes/Jogos/Livros que antes ocupava a Home inteira (cópia do perfil
// público) continua existindo, mas rebaixado a seção secundária abaixo —
// Séries saiu desse conjunto porque ganhou a seção própria acima.
//
// As abas da seção secundária são estado local, não rota: diferente do
// perfil público, "/filmes", "/series" etc. já são as telas de Descobrir/
// marcações de cada seção (ver router.tsx), então a home não pode
// reivindicar esses caminhos pras suas abas.
export function Home() {
  const [activeTab, setActiveTab] = useState<HomeTab>("movies");

  return (
    <div className={styles.page}>
      <h1>cqntrack</h1>

      <h2>Continuar assistindo</h2>
      <ContinueWatching />

      <h2>Atividades recentes</h2>
      <ActivityTab />

      <div className={styles.secondary}>
        <h2>Filmes, jogos e livros</h2>
        <HomeTabs active={activeTab} onChange={setActiveTab} />
        <div className={styles.layout}>
          <div className={styles.main}>
            {activeTab === "movies" && (
              <>
                <MovieFavorites basePath={BASE_PATH} />
                <RecentlyWatchedMovies basePath={BASE_PATH} />
              </>
            )}
            {activeTab === "games" && (
              <>
                <FavoritesSection favoritesEndpoint="/api/games/favorites" />
                <RecentlyPlayedGames basePath={BASE_PATH} />
              </>
            )}
            {activeTab === "books" && (
              <>
                <BookFavoritesSection favoritesEndpoint="/api/books/favorites" />
                <RecentlyReadBooks basePath={BASE_PATH} />
              </>
            )}
          </div>

          <aside className={styles.sidebar}>
            {activeTab === "movies" && (
              <MovieStats basePath={BASE_PATH} linkBase="/filmes/marcacoes" />
            )}
            {activeTab === "games" && (
              <GameStats basePath={BASE_PATH} linkBase="/jogos/marcacoes" />
            )}
            {activeTab === "books" && (
              <BookStats basePath={BASE_PATH} linkBase="/livros/marcacoes" />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
