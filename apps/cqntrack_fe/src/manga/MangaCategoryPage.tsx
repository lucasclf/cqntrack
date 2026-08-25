import { MediaPageLayout } from "../components/MediaPageLayout";
import { MangaStats } from "../profile/MangaStats";
import { MangaCategoryPanel } from "./MangaCategoryPanel";

// Rota /mangas — antes vivia inline na aba "Mangás" da Home (deletada, ver
// router.tsx); agora é uma página própria.
export function MangaCategoryPage() {
  return (
    <MediaPageLayout
      main={<MangaCategoryPanel basePath="/api" />}
      sidebar={<MangaStats basePath="/api" linkBase="/mangas/marcacoes" />}
    />
  );
}
