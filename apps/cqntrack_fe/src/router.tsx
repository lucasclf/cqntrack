import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { GameDetail } from "./games/GameDetail";
import { GameSearch } from "./games/GameSearch";
import { MyEntries } from "./games/MyEntries";
import { AppShell } from "./layouts/AppShell";
import { Home } from "./Home";
import { Login } from "./Login";
import { RequireAuth } from "./routes/RequireAuth";
import { Signup } from "./Signup";
import { Unavailable } from "./Unavailable";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/cadastro", element: <Signup /> },
  { path: "/esqueci-senha", element: <Unavailable /> },
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
          // Listas (Commit 11) ainda não tem página própria — aponta pra
          // Unavailable até lá.
          { path: "listas", element: <Unavailable /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
