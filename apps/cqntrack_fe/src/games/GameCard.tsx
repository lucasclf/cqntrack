import { GAME_STATUS_LABELS, type GameEntry, type GameSummary } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./GameCard.module.css";

interface GameCardProps {
  game: GameSummary;
  // Presente nas telas que já sabem a marcação do usuário pro jogo
  // (marcações, listas, perfil) — ausente na busca, onde não existe ainda.
  entry?: GameEntry;
}

// Cartão de jogo reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe do jogo (/jogos/:igdbId).
export function GameCard({ game, entry }: GameCardProps) {
  const year = game.firstReleaseDate ? game.firstReleaseDate.slice(0, 4) : null;
  const extraPlatforms = game.platforms.length - 1;

  return (
    <Link to={`/jogos/${game.igdbId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {game.coverUrl ? (
          <img className={styles.cover} src={game.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {game.rating !== null && <span className={styles.ratingBadge}>{Math.round(game.rating)}</span>}
        {entry?.favoriteSlot != null && (
          <span className={styles.favoriteBadge} aria-label="Favoritado">
            ♥
          </span>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{game.name}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {game.platforms.length > 0 &&
            ` · ${game.platforms[0]}${extraPlatforms > 0 ? ` +${extraPlatforms}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {entry && (
          <p className={styles.entryMeta}>
            {entry.status && <span className={styles.statusPill}>{GAME_STATUS_LABELS[entry.status]}</span>}
            {entry.rating !== null && (
              <span className={styles.personalRating}>★ {entry.rating.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
