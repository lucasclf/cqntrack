import { MediaPageLayout } from "../components/MediaPageLayout";
import { MovieStats } from "../profile/MovieStats";
import { MovieCategoryPanel } from "./MovieCategoryPanel";

// Rota /filmes — antes vivia inline na aba "Filmes" da Home (deletada, ver
// router.tsx); agora é uma página própria.
export function MovieCategoryPage() {
  return (
    <MediaPageLayout
      main={<MovieCategoryPanel basePath="/api" />}
      sidebar={<MovieStats basePath="/api" linkBase="/filmes/marcacoes" />}
    />
  );
}
