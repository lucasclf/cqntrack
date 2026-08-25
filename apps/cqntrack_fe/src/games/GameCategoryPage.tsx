import { MediaPageLayout } from "../components/MediaPageLayout";
import { GameStats } from "../profile/GameStats";
import { GameCategoryPanel } from "./GameCategoryPanel";

// Rota /jogos — antes vivia inline na aba "Jogos" da Home (deletada, ver
// router.tsx); agora é uma página própria.
export function GameCategoryPage() {
  return (
    <MediaPageLayout
      main={<GameCategoryPanel basePath="/api" />}
      sidebar={<GameStats basePath="/api" linkBase="/jogos/marcacoes" />}
    />
  );
}
