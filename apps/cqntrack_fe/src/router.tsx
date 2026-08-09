import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { GameSearch } from "./games/GameSearch";
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
          // Detalhe do jogo (Commit 9), Marcações (Commit 10) e Listas
          // (Commit 11) ainda não têm página própria — apontam pra
          // Unavailable até lá.
          { path: "jogos/:igdbId", element: <Unavailable /> },
          { path: "marcacoes", element: <Unavailable /> },
          { path: "listas", element: <Unavailable /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
