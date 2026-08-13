import { MEDIA_TYPE_LABELS, MEDIA_TYPES, type MediaType } from "@cqntrack/shared";
import { useState } from "react";
import { ActivityFeed } from "./games/ActivityFeed";
import styles from "./ActivityTab.module.css";

type MediaFilter = MediaType | "all";

const FILTERS: { key: MediaFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  ...MEDIA_TYPES.map((mediaType) => ({ key: mediaType, label: MEDIA_TYPE_LABELS[mediaType] })),
];

// Aba "Atividades" da home — mesmo feed de sempre (ActivityFeed), com um
// filtro por mídia na frente. Troca a `key` do ActivityFeed ao mudar o
// filtro em vez de reagir à prop internamente — reaproveita o mesmo "reset
// remontando do zero" já usado noutras trocas de identidade no app, sem
// precisar sincronizar cursor/itens manualmente.
export function ActivityTab() {
  const [filter, setFilter] = useState<MediaFilter>("all");

  return (
    <div>
      <div className={styles.filters} role="group" aria-label="Filtrar por mídia">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={filter === option.key}
            className={
              filter === option.key ? `${styles.filter} ${styles.filterActive}` : styles.filter
            }
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <ActivityFeed key={filter} mediaType={filter === "all" ? undefined : filter} />
    </div>
  );
}
