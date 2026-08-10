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
import { PublicListDetail } from "./profile/PublicListDetail";
import { PublicProfile } from "./profile/PublicProfile";
import { RedirectToJogosListDetail } from "./routes/RedirectToJogosListDetail";
import { RequireAuth } from "./routes/RequireAuth";
import { SeriesDetail } from "./series/SeriesDetail";
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
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
