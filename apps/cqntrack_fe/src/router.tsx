import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
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
    children: [{ index: true, element: <Home /> }],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];

export const router = createBrowserRouter(routes);
