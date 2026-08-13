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
import { RecentlyWatchedSeries } from "./profile/RecentlyWatchedSeries";
import { SeriesFavorites } from "./profile/SeriesFavorites";
import { SeriesStats } from "./profile/SeriesStats";

const BASE_PATH = "/api";

// Home é essencialmente uma cópia do perfil público (mesmas abas, mesmos
// componentes de favoritos/recentes/estatísticas — ver profile/*, todos
// parametrizados por basePath pra servir tanto "/api/users/:username"
// quanto "/api" aqui), mostrando os dados do próprio usuário logado. Sem
// header de avatar/nome (o AppShell já mostra a conta logada no dropdown).
// Ganha uma 5ª aba, "Atividades", que o perfil público não tem.
//
// As abas aqui são estado local, não rota: diferente do perfil público,
// "/filmes", "/series" etc. já são as telas de Descobrir/marcações de cada
// seção (ver router.tsx), então a home não pode reivindicar esses caminhos
// pras suas abas. As estatísticas clicáveis levam pra essas telas reais de
// marcações (com ?status= como filtro inicial, ver MyMovieEntries/etc.),
// em vez de uma listagem própria da home.
export function Home() {
  const [activeTab, setActiveTab] = useState<HomeTab>("movies");

  return (
    <div className={styles.page}>
      <h1>cqntrack</h1>
      <HomeTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "activity" ? (
        <ActivityTab />
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            {activeTab === "movies" && (
              <>
                <MovieFavorites basePath={BASE_PATH} />
                <RecentlyWatchedMovies basePath={BASE_PATH} />
              </>
            )}
            {activeTab === "series" && (
              <>
                <SeriesFavorites basePath={BASE_PATH} />
                <RecentlyWatchedSeries basePath={BASE_PATH} />
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
            {activeTab === "series" && (
              <SeriesStats basePath={BASE_PATH} linkTo="/series/marcacoes" />
            )}
            {activeTab === "games" && (
              <GameStats basePath={BASE_PATH} linkBase="/jogos/marcacoes" />
            )}
            {activeTab === "books" && (
              <BookStats basePath={BASE_PATH} linkBase="/livros/marcacoes" />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
