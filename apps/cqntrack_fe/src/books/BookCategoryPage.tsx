import { MediaPageLayout } from "../components/MediaPageLayout";
import { BookStats } from "../profile/BookStats";
import { BookCategoryPanel } from "./BookCategoryPanel";

// Rota /livros — antes vivia inline na aba "Livros" da Home (deletada, ver
// router.tsx); agora é uma página própria. Primeira vez que livros ganha
// uma rota índice — antes ia direto pra /livros/buscar.
export function BookCategoryPage() {
  return (
    <MediaPageLayout
      main={<BookCategoryPanel basePath="/api" />}
      sidebar={<BookStats basePath="/api" linkBase="/livros/marcacoes" />}
    />
  );
}
