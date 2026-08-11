import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { GameDetail } from "./games/GameDetail";
import { GameSearch } from "./games/GameSearch";
import { ListDetail } from "./games/ListDetail";
import { MyEntries } from "./games/MyEntries";
import { MyLists } from "./games/MyLists";
import { AppShell } from "./layouts/AppShell";
import { Account } from "./Account";
import { Home } from "./Home";
import { Login } from "./Login";
import { MovieDetail } from "./movies/MovieDetail";
import { MovieSearch } from "./movies/MovieSearch";
import { PublicListDetail } from "./profile/PublicListDetail";
import { PublicProfile } from "./profile/PublicProfile";
import { RedirectToJogosListDetail } from "./routes/RedirectToJogosListDetail";
import { RequireAuth } from "./routes/RequireAuth";
import { MySeriesEntries } from "./series/MySeriesEntries";
import { MySeriesLists } from "./series/MySeriesLists";
import { SeriesDetail } from "./series/SeriesDetail";
import { SeriesListDetail } from "./series/SeriesListDetail";
import { SeriesSearch } from "./series/SeriesSearch";
import { Signup } from "./Signup";
import { Unavailable } from "./Unavailable";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/cadastro", element: <Signup /> },
  { path: "/esqueci-senha", element: <Unavailable /> },
  { path: "/u/:username", element: <PublicProfile /> },
  { path: "/u/:username/listas/:listId", element: <PublicListDetail /> },
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
              { path: "buscar", element: <SeriesSearch /> },
              { path: ":tmdbId", element: <SeriesDetail /> },
              { path: "marcacoes", element: <MySeriesEntries /> },
              { path: "listas", element: <MySeriesLists /> },
              { path: "listas/:listId", element: <SeriesListDetail /> },
            ],
          },
          {
            path: "filmes",
            children: [
              { path: "buscar", element: <MovieSearch /> },
              { path: ":tmdbId", element: <MovieDetail /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
