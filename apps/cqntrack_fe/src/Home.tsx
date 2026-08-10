import { ActivityFeed } from "./games/ActivityFeed";
import { FavoriteSlots } from "./games/FavoriteSlots";
import styles from "./Home.module.css";

export function Home() {
  return (
    <div className={styles.page}>
      <h1>cqntrack</h1>
      <FavoriteSlots />
      <h2>Atividade recente</h2>
      <ActivityFeed />
    </div>
  );
}
