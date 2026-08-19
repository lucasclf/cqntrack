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
import { SeriesFavorites } from "./profile/SeriesFavorites";
import { SeriesStats } from "./profile/SeriesStats";
import { ContinueWatching } from "./series/ContinueWatching";
import { RecentlyWatchedSeries } from "./profile/RecentlyWatchedSeries";

const BASE_PATH = "/api";

// 6 abas puramente visuais (estado local, não rota) — Continuar assistindo/
// Séries/Filmes/Jogos/Livros/Atividades recentes. Todo o conteúdo carrega
// assim que a Home monta: as 6 seções ficam sempre no DOM, cada uma com
// seu próprio fetch (useEffect de sempre); trocar de aba só alterna quem
// fica visível via `hidden`, sem desmontar nada — voltar pra uma aba já
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

      {/* `hidden` fica num wrapper só com esse atributo — colocar junto de
          className={styles.layout} não funciona: CSS de autor (o
          `display: grid` do módulo) sempre vence o `display: none` padrão
          do atributo `hidden` do navegador, então o bloco continuava
          visível mesmo escondido. */}
      <div hidden={activeTab !== "series"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <SeriesFavorites basePath={BASE_PATH} emptyMessage="Nenhuma série favoritada ainda." />
            <RecentlyWatchedSeries
              basePath={BASE_PATH}
              emptyMessage="Nenhuma série assistida recentemente."
            />
          </div>
          <aside className={styles.sidebar}>
            <SeriesStats basePath={BASE_PATH} linkTo="/series/marcacoes" />
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== "movies"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <MovieFavorites basePath={BASE_PATH} emptyMessage="Nenhum filme favoritado ainda." />
            <RecentlyWatchedMovies
              basePath={BASE_PATH}
              emptyMessage="Nenhum filme assistido recentemente."
            />
          </div>
          <aside className={styles.sidebar}>
            <MovieStats basePath={BASE_PATH} linkBase="/filmes/marcacoes" />
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== "games"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <FavoritesSection
              favoritesEndpoint="/api/games/favorites"
              emptyMessage="Nenhum jogo favoritado ainda."
            />
            <RecentlyPlayedGames
              basePath={BASE_PATH}
              emptyMessage="Nenhum jogo jogado recentemente."
            />
          </div>
          <aside className={styles.sidebar}>
            <GameStats basePath={BASE_PATH} linkBase="/jogos/marcacoes" />
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== "books"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <BookFavoritesSection
              favoritesEndpoint="/api/books/favorites"
              emptyMessage="Nenhum livro favoritado ainda."
            />
            <RecentlyReadBooks
              basePath={BASE_PATH}
              emptyMessage="Nenhum livro lido recentemente."
            />
          </div>
          <aside className={styles.sidebar}>
            <BookStats basePath={BASE_PATH} linkBase="/livros/marcacoes" />
          </aside>
        </div>
      </div>
    </div>
  );
}
