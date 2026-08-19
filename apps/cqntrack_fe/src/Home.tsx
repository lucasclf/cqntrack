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

// 5 abas puramente visuais (estado local, não rota) — Continuar assistindo/
// Filmes/Jogos/Livros/Atividades recentes. Todo o conteúdo carrega assim
// que a Home monta: as 5 seções ficam sempre no DOM, cada uma com seu
// próprio fetch (useEffect de sempre); trocar de aba só alterna quem fica
// visível via `hidden`, sem desmontar nada — voltar pra uma aba já
// visitada não refaz o fetch. Sem <h1> aqui: o nome "cqntrack" já aparece
// no header (ver TopBar), repetir no corpo era redundante.
export function Home() {
  const [activeTab, setActiveTab] = useState<HomeTab>("continueWatching");

  return (
    <div className={styles.page}>
      <HomeTabs active={activeTab} onChange={setActiveTab} />

      <div hidden={activeTab !== "continueWatching"}>
        <ContinueWatching />
      </div>

      <div hidden={activeTab !== "activity"}>
        <ActivityTab />
      </div>

      <div hidden={activeTab !== "movies"} className={styles.layout}>
        <div className={styles.main}>
          <MovieFavorites basePath={BASE_PATH} />
          <RecentlyWatchedMovies basePath={BASE_PATH} />
        </div>
        <aside className={styles.sidebar}>
          <MovieStats basePath={BASE_PATH} linkBase="/filmes/marcacoes" />
        </aside>
      </div>

      <div hidden={activeTab !== "games"} className={styles.layout}>
        <div className={styles.main}>
          <FavoritesSection favoritesEndpoint="/api/games/favorites" />
          <RecentlyPlayedGames basePath={BASE_PATH} />
        </div>
        <aside className={styles.sidebar}>
          <GameStats basePath={BASE_PATH} linkBase="/jogos/marcacoes" />
        </aside>
      </div>

      <div hidden={activeTab !== "books"} className={styles.layout}>
        <div className={styles.main}>
          <BookFavoritesSection favoritesEndpoint="/api/books/favorites" />
          <RecentlyReadBooks basePath={BASE_PATH} />
        </div>
        <aside className={styles.sidebar}>
          <BookStats basePath={BASE_PATH} linkBase="/livros/marcacoes" />
        </aside>
      </div>
    </div>
  );
}
