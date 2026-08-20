import { useState } from "react";
import { ActivityTab } from "./ActivityTab";
import { BookCategoryPanel } from "./books/BookCategoryPanel";
import { GameCategoryPanel } from "./games/GameCategoryPanel";
import styles from "./Home.module.css";
import { HomeTabs, type HomeTab } from "./HomeTabs";
import { MovieCategoryPanel } from "./movies/MovieCategoryPanel";
import { BookStats } from "./profile/BookStats";
import { GameStats } from "./profile/GameStats";
import { MovieStats } from "./profile/MovieStats";
import { SeriesStats } from "./profile/SeriesStats";
import { ContinueWatching } from "./series/ContinueWatching";
import { SeriesCategoryPanel } from "./series/SeriesCategoryPanel";

const BASE_PATH = "/api";

// 6 abas puramente visuais (estado local, não rota) — Continuar assistindo/
// Séries/Filmes/Jogos/Livros/Atividades recentes. Todo o conteúdo carrega
// assim que a Home monta: as 6 seções ficam sempre no DOM, cada uma com
// seu próprio fetch (useEffect de sempre); trocar de aba só alterna quem
// fica visível via `hidden`, sem desmontar nada — voltar pra uma aba já
// visitada não refaz o fetch. Sem <h1> aqui: o nome "cqntrack" já aparece
// no header (ver TopBar), repetir no corpo era redundante.
//
// Cada uma das 4 seções de mídia (Séries/Filmes/Jogos/Livros) usa um
// *CategoryPanel próprio (ver movies/MovieCategoryPanel.tsx e afins) —
// favoritos e recentes viraram 2 sub-abas com rolagem infinita vertical,
// no lugar do carrossel horizontal antigo (esse continua em uso no perfil
// público, que não muda — ver MovieFavorites/RecentlyWatchedMovies etc.).
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
            <SeriesCategoryPanel basePath={BASE_PATH} />
          </div>
          <aside className={styles.sidebar}>
            <SeriesStats basePath={BASE_PATH} linkTo="/series/marcacoes" />
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== "movies"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <MovieCategoryPanel basePath={BASE_PATH} />
          </div>
          <aside className={styles.sidebar}>
            <MovieStats basePath={BASE_PATH} linkBase="/filmes/marcacoes" />
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== "games"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <GameCategoryPanel basePath={BASE_PATH} />
          </div>
          <aside className={styles.sidebar}>
            <GameStats basePath={BASE_PATH} linkBase="/jogos/marcacoes" />
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== "books"}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <BookCategoryPanel basePath={BASE_PATH} />
          </div>
          <aside className={styles.sidebar}>
            <BookStats basePath={BASE_PATH} linkBase="/livros/marcacoes" />
          </aside>
        </div>
      </div>
    </div>
  );
}
