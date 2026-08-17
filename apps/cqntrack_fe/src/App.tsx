import { RouterProvider } from "react-router/dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { router } from "./router";

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
