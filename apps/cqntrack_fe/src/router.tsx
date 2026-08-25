import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "./layouts/AppShell";
import { Account } from "./Account";
import { ForgotPassword } from "./ForgotPassword";
import { Login } from "./Login";
import { RedirectToJogosListDetail } from "./routes/RedirectToJogosListDetail";
import { RequireAuth } from "./routes/RequireAuth";
import { ResetPassword } from "./ResetPassword";
import { Signup } from "./Signup";

// Cada tela "de verdade" (não a casca/layout em volta dela) é carregada sob
// demanda — antes, o router importava todas de uma vez, e era a causa direta
// do aviso de bundle >500KB do Vite no build. `lazy` é a API nativa do
// react-router (não React.lazy/Suspense manual): o router já lida com a
// transição sozinho, sem precisar de um fallback de loading por rota.
//
// *Discover.tsx (jogos/séries/filmes/mangás) e BookSearch.tsx não têm mais
// entrada aqui como rota índice própria — viraram a 3ª aba "Descobrir" de
// cada *CategoryPanel.tsx, importados direto por eles (ver
// games/GameCategoryPanel.tsx e afins), carregando junto do chunk da
// *CategoryPage correspondente.
const routeModules = {
  authorDetail: () => import("./books/AuthorDetail"),
  bookCategoryPage: () => import("./books/BookCategoryPage"),
  bookDetail: () => import("./books/BookDetail"),
  bookListDetail: () => import("./books/BookListDetail"),
  bookSearch: () => import("./books/BookSearch"),
  myBookEntries: () => import("./books/MyBookEntries"),
  myBookLists: () => import("./books/MyBookLists"),
  gameCategoryPage: () => import("./games/GameCategoryPage"),
  gameDetail: () => import("./games/GameDetail"),
  gameSearch: () => import("./games/GameSearch"),
  listDetail: () => import("./games/ListDetail"),
  myEntries: () => import("./games/MyEntries"),
  myLists: () => import("./games/MyLists"),
  mangaAuthorDetail: () => import("./manga/AuthorDetail"),
  mangaCategoryPage: () => import("./manga/MangaCategoryPage"),
  mangaDetail: () => import("./manga/MangaDetail"),
  mangaListDetail: () => import("./manga/MangaListDetail"),
  mangaSearch: () => import("./manga/MangaSearch"),
  myMangaEntries: () => import("./manga/MyMangaEntries"),
  myMangaLists: () => import("./manga/MyMangaLists"),
  movieCategoryPage: () => import("./movies/MovieCategoryPage"),
  movieDetail: () => import("./movies/MovieDetail"),
  movieListDetail: () => import("./movies/MovieListDetail"),
  movieSearch: () => import("./movies/MovieSearch"),
  myMovieEntries: () => import("./movies/MyMovieEntries"),
  myMovieLists: () => import("./movies/MyMovieLists"),
  personDetail: () => import("./people/PersonDetail"),
  bookTabPanel: () => import("./profile/BookTabPanel"),
  gameTabPanel: () => import("./profile/GameTabPanel"),
  mangaTabPanel: () => import("./profile/MangaTabPanel"),
  movieTabPanel: () => import("./profile/MovieTabPanel"),
  publicListDetail: () => import("./profile/PublicListDetail"),
  publicProfile: () => import("./profile/PublicProfile"),
  seriesTabPanel: () => import("./profile/SeriesTabPanel"),
  activityTab: () => import("./ActivityTab"),
  continueWatching: () => import("./series/ContinueWatching"),
  episodeDetail: () => import("./series/EpisodeDetail"),
  mySeriesEntries: () => import("./series/MySeriesEntries"),
  mySeriesLists: () => import("./series/MySeriesLists"),
  seriesCategoryPage: () => import("./series/SeriesCategoryPage"),
  seriesDetail: () => import("./series/SeriesDetail"),
  seriesListDetail: () => import("./series/SeriesListDetail"),
  seriesSearch: () => import("./series/SeriesSearch"),
  friendsPage: () => import("./social/FriendsPage"),
};

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/cadastro", element: <Signup /> },
  { path: "/esqueci-senha", element: <ForgotPassword /> },
  { path: "/redefinir-senha", element: <ResetPassword /> },
  // react-router não casa texto literal + parâmetro no mesmo segmento
  // (confirmado: "/@:username" nunca dá match) — captura o segmento inteiro
  // ("@lucas") como :handle e separa o "@" dentro do componente.
  // PublicProfile é uma casca persistente (header/abas/lateral de
  // estatísticas) — as 4 abas são rotas filhas de verdade, renderizadas
  // via <Outlet/>, pra trocar de aba/estatística sem desmontar o resto.
  {
    path: "/:handle",
    lazy: async () => ({ Component: (await routeModules.publicProfile()).PublicProfile }),
    children: [
      { index: true, element: <Navigate to="filmes" replace /> },
      {
        path: "filmes",
        lazy: async () => ({ Component: (await routeModules.movieTabPanel()).MovieTabPanel }),
      },
      {
        path: "series",
        lazy: async () => ({ Component: (await routeModules.seriesTabPanel()).SeriesTabPanel }),
      },
      {
        path: "jogos",
        lazy: async () => ({ Component: (await routeModules.gameTabPanel()).GameTabPanel }),
      },
      {
        path: "livros",
        lazy: async () => ({ Component: (await routeModules.bookTabPanel()).BookTabPanel }),
      },
      {
        path: "mangas",
        lazy: async () => ({ Component: (await routeModules.mangaTabPanel()).MangaTabPanel }),
      },
    ],
  },
  {
    path: "/:handle/listas/:listId",
    lazy: async () => ({ Component: (await routeModules.publicListDetail()).PublicListDetail }),
  },
  { path: "/buscar", element: <Navigate to="/jogos/buscar" replace /> },
  { path: "/marcacoes", element: <Navigate to="/jogos/marcacoes" replace /> },
  { path: "/listas", element: <Navigate to="/jogos/listas" replace /> },
  { path: "/listas/:listId", element: <RedirectToJogosListDetail /> },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await routeModules.continueWatching()).ContinueWatching,
            }),
          },
          { path: "conta", element: <Account /> },
          {
            path: "atividades",
            lazy: async () => ({ Component: (await routeModules.activityTab()).ActivityTab }),
          },
          {
            path: "social",
            lazy: async () => ({ Component: (await routeModules.friendsPage()).FriendsPage }),
          },
          {
            path: "jogos",
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await routeModules.gameCategoryPage()).GameCategoryPage,
                }),
              },
              {
                path: "buscar",
                lazy: async () => ({ Component: (await routeModules.gameSearch()).GameSearch }),
              },
              {
                path: ":igdbId",
                lazy: async () => ({ Component: (await routeModules.gameDetail()).GameDetail }),
              },
              {
                path: "marcacoes",
                lazy: async () => ({ Component: (await routeModules.myEntries()).MyEntries }),
              },
              {
                path: "listas",
                lazy: async () => ({ Component: (await routeModules.myLists()).MyLists }),
              },
              {
                path: "listas/:listId",
                lazy: async () => ({ Component: (await routeModules.listDetail()).ListDetail }),
              },
            ],
          },
          {
            path: "series",
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await routeModules.seriesCategoryPage()).SeriesCategoryPage,
                }),
              },
              {
                path: "buscar",
                lazy: async () => ({ Component: (await routeModules.seriesSearch()).SeriesSearch }),
              },
              {
                path: ":tmdbId",
                lazy: async () => ({ Component: (await routeModules.seriesDetail()).SeriesDetail }),
              },
              {
                path: "marcacoes",
                lazy: async () => ({
                  Component: (await routeModules.mySeriesEntries()).MySeriesEntries,
                }),
              },
              {
                path: "listas",
                lazy: async () => ({
                  Component: (await routeModules.mySeriesLists()).MySeriesLists,
                }),
              },
              {
                path: "listas/:listId",
                lazy: async () => ({
                  Component: (await routeModules.seriesListDetail()).SeriesListDetail,
                }),
              },
              {
                path: ":tmdbId/temporadas/:seasonNumber/episodios/:episodeNumber",
                lazy: async () => ({
                  Component: (await routeModules.episodeDetail()).EpisodeDetail,
                }),
              },
            ],
          },
          {
            path: "filmes",
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await routeModules.movieCategoryPage()).MovieCategoryPage,
                }),
              },
              {
                path: "buscar",
                lazy: async () => ({ Component: (await routeModules.movieSearch()).MovieSearch }),
              },
              {
                path: ":tmdbId",
                lazy: async () => ({ Component: (await routeModules.movieDetail()).MovieDetail }),
              },
              {
                path: "marcacoes",
                lazy: async () => ({
                  Component: (await routeModules.myMovieEntries()).MyMovieEntries,
                }),
              },
              {
                path: "listas",
                lazy: async () => ({ Component: (await routeModules.myMovieLists()).MyMovieLists }),
              },
              {
                path: "listas/:listId",
                lazy: async () => ({
                  Component: (await routeModules.movieListDetail()).MovieListDetail,
                }),
              },
            ],
          },
          {
            path: "livros",
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await routeModules.bookCategoryPage()).BookCategoryPage,
                }),
              },
              {
                path: "buscar",
                lazy: async () => ({ Component: (await routeModules.bookSearch()).BookSearch }),
              },
              {
                path: "autores/:name",
                lazy: async () => ({ Component: (await routeModules.authorDetail()).AuthorDetail }),
              },
              {
                path: ":googleBooksId",
                lazy: async () => ({ Component: (await routeModules.bookDetail()).BookDetail }),
              },
              {
                path: "marcacoes",
                lazy: async () => ({
                  Component: (await routeModules.myBookEntries()).MyBookEntries,
                }),
              },
              {
                path: "listas",
                lazy: async () => ({ Component: (await routeModules.myBookLists()).MyBookLists }),
              },
              {
                path: "listas/:listId",
                lazy: async () => ({
                  Component: (await routeModules.bookListDetail()).BookListDetail,
                }),
              },
            ],
          },
          {
            path: "mangas",
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await routeModules.mangaCategoryPage()).MangaCategoryPage,
                }),
              },
              {
                path: "buscar",
                lazy: async () => ({ Component: (await routeModules.mangaSearch()).MangaSearch }),
              },
              {
                path: "autores/:authorId",
                lazy: async () => ({
                  Component: (await routeModules.mangaAuthorDetail()).AuthorDetail,
                }),
              },
              {
                path: ":mangadexId",
                lazy: async () => ({ Component: (await routeModules.mangaDetail()).MangaDetail }),
              },
              {
                path: "marcacoes",
                lazy: async () => ({
                  Component: (await routeModules.myMangaEntries()).MyMangaEntries,
                }),
              },
              {
                path: "listas",
                lazy: async () => ({ Component: (await routeModules.myMangaLists()).MyMangaLists }),
              },
              {
                path: "listas/:listId",
                lazy: async () => ({
                  Component: (await routeModules.mangaListDetail()).MangaListDetail,
                }),
              },
            ],
          },
          // Sem seção própria (não é um MEDIA_TYPE) — só alcançável por link
          // de dentro de um filme/série (elenco/direção).
          {
            path: "pessoas/:personId",
            lazy: async () => ({ Component: (await routeModules.personDetail()).PersonDetail }),
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
