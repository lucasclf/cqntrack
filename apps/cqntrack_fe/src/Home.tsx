import { ActivityFeed } from "./games/ActivityFeed";
import { FavoriteSlots } from "./games/FavoriteSlots";
import styles from "./Home.module.css";
import { MovieFavoriteSlots } from "./movies/MovieFavoriteSlots";
import { SeriesFavoriteSlots } from "./series/SeriesFavoriteSlots";

export function Home() {
  return (
    <div className={styles.page}>
      <h1>cqntrack</h1>
      <h2>Jogos favoritos</h2>
      <FavoriteSlots />
      <h2>Séries favoritas</h2>
      <SeriesFavoriteSlots />
      <h2>Filmes favoritos</h2>
      <MovieFavoriteSlots />
      <h2>Atividade recente</h2>
      <ActivityFeed />
    </div>
  );
}
