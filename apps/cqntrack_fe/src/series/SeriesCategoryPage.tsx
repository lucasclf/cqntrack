import { MediaPageLayout } from "../components/MediaPageLayout";
import { SeriesStats } from "../profile/SeriesStats";
import { SeriesCategoryPanel } from "./SeriesCategoryPanel";

// Rota /series — antes vivia inline na aba "Séries" da Home (deletada, ver
// router.tsx); agora é uma página própria.
export function SeriesCategoryPage() {
  return (
    <MediaPageLayout
      main={<SeriesCategoryPanel basePath="/api" />}
      sidebar={<SeriesStats basePath="/api" linkTo="/series/marcacoes" />}
    />
  );
}
