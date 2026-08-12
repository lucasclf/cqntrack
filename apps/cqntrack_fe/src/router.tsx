import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AuthorDetail } from "./books/AuthorDetail";
import { BookDetail } from "./books/BookDetail";
import { BookListDetail } from "./books/BookListDetail";
import { BookSearch } from "./books/BookSearch";
import { MyBookEntries } from "./books/MyBookEntries";
import { MyBookLists } from "./books/MyBookLists";
import { GameDetail } from "./games/GameDetail";
import { GameDiscover } from "./games/GameDiscover";
import { GameSearch } from "./games/GameSearch";
import { ListDetail } from "./games/ListDetail";
import { MyEntries } from "./games/MyEntries";
import { MyLists } from "./games/MyLists";
import { AppShell } from "./layouts/AppShell";
import { Account } from "./Account";
import { Home } from "./Home";
import { Login } from "./Login";
import { MovieDetail } from "./movies/MovieDetail";
import { MovieDiscover } from "./movies/MovieDiscover";
import { MovieListDetail } from "./movies/MovieListDetail";
import { MovieSearch } from "./movies/MovieSearch";
import { MyMovieEntries } from "./movies/MyMovieEntries";
import { MyMovieLists } from "./movies/MyMovieLists";
import { PersonDetail } from "./people/PersonDetail";
import { PublicListDetail } from "./profile/PublicListDetail";
import { PublicProfile } from "./profile/PublicProfile";
import { RedirectToJogosListDetail } from "./routes/RedirectToJogosListDetail";
import { RequireAuth } from "./routes/RequireAuth";
import { EpisodeDetail } from "./series/EpisodeDetail";
import { MySeriesEntries } from "./series/MySeriesEntries";
import { MySeriesLists } from "./series/MySeriesLists";
import { SeriesDetail } from "./series/SeriesDetail";
import { SeriesDiscover } from "./series/SeriesDiscover";
import { SeriesListDetail } from "./series/SeriesListDetail";
import { SeriesSearch } from "./series/SeriesSearch";
import { Signup } from "./Signup";
import { Unavailable } from "./Unavailable";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/cadastro", element: <Signup /> },
  { path: "/esqueci-senha", element: <Unavailable /> },
  // react-router não casa texto literal + parâmetro no mesmo segmento
  // (confirmado: "/@:username" nunca dá match) — captura o segmento inteiro
  // ("@lucas") como :handle e separa o "@" dentro do componente.
  { path: "/:handle", element: <PublicProfile /> },
  { path: "/:handle/listas/:listId", element: <PublicListDetail /> },
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
          { index: true, element: <Home /> },
          { path: "conta", element: <Account /> },
          {
            path: "jogos",
            children: [
              { index: true, element: <GameDiscover /> },
              { path: "buscar", element: <GameSearch /> },
              { path: ":igdbId", element: <GameDetail /> },
              { path: "marcacoes", element: <MyEntries /> },
              { path: "listas", element: <MyLists /> },
              { path: "listas/:listId", element: <ListDetail /> },
            ],
          },
          {
            path: "series",
            children: [
              { index: true, element: <SeriesDiscover /> },
              { path: "buscar", element: <SeriesSearch /> },
              { path: ":tmdbId", element: <SeriesDetail /> },
              { path: "marcacoes", element: <MySeriesEntries /> },
              { path: "listas", element: <MySeriesLists /> },
              { path: "listas/:listId", element: <SeriesListDetail /> },
              {
                path: ":tmdbId/temporadas/:seasonNumber/episodios/:episodeNumber",
                element: <EpisodeDetail />,
              },
            ],
          },
          {
            path: "filmes",
            children: [
              { index: true, element: <MovieDiscover /> },
              { path: "buscar", element: <MovieSearch /> },
              { path: ":tmdbId", element: <MovieDetail /> },
              { path: "marcacoes", element: <MyMovieEntries /> },
              { path: "listas", element: <MyMovieLists /> },
              { path: "listas/:listId", element: <MovieListDetail /> },
            ],
          },
          {
            path: "livros",
            children: [
              { path: "buscar", element: <BookSearch /> },
              { path: "autores/:name", element: <AuthorDetail /> },
              { path: ":googleBooksId", element: <BookDetail /> },
              { path: "marcacoes", element: <MyBookEntries /> },
              { path: "listas", element: <MyBookLists /> },
              { path: "listas/:listId", element: <BookListDetail /> },
            ],
          },
          // Sem seção própria (não é um MEDIA_TYPE) — só alcançável por link
          // de dentro de um filme/série (elenco/direção).
          { path: "pessoas/:personId", element: <PersonDetail /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
