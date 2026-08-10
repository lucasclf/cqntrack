import { ActivityFeed } from "./games/ActivityFeed";
import { FavoritesSection } from "./games/FavoritesSection";
import styles from "./Home.module.css";

export function Home() {
  return (
    <div className={styles.page}>
      <h1>cqntrack</h1>
      <FavoritesSection entriesEndpoint="/api/games/entries" />
      <h2>Atividade recente</h2>
      <ActivityFeed />
    </div>
  );
}
