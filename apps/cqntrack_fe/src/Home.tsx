import { BookFavoritesGrid } from "./books/BookFavoritesGrid";
import { ActivityFeed } from "./games/ActivityFeed";
import { FavoritesGrid } from "./games/FavoritesGrid";
import styles from "./Home.module.css";
import { MovieFavoritesGrid } from "./movies/MovieFavoritesGrid";
import { SeriesFavoritesGrid } from "./series/SeriesFavoritesGrid";

export function Home() {
  return (
    <div className={styles.page}>
      <h1>cqntrack</h1>
      <h2>Jogos favoritos</h2>
      <FavoritesGrid />
      <h2>Séries favoritas</h2>
      <SeriesFavoritesGrid />
      <h2>Filmes favoritos</h2>
      <MovieFavoritesGrid />
      <h2>Livros favoritos</h2>
      <BookFavoritesGrid />
      <h2>Atividade recente</h2>
      <ActivityFeed />
    </div>
  );
}
