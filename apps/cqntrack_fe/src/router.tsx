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
import { RequireAuth } from "./routes/RequireAuth";
import { Signup } from "./Signup";
import { Unavailable } from "./Unavailable";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/cadastro", element: <Signup /> },
  { path: "/esqueci-senha", element: <Unavailable /> },
  { path: "/u/:username", element: <PublicProfile /> },
  { path: "/u/:username/listas/:listId", element: <PublicListDetail /> },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Home /> },
          { path: "buscar", element: <GameSearch /> },
          { path: "jogos/:igdbId", element: <GameDetail /> },
          { path: "marcacoes", element: <MyEntries /> },
          { path: "listas", element: <MyLists /> },
          { path: "listas/:listId", element: <ListDetail /> },
          { path: "conta", element: <Account /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
