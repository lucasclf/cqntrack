import { useState } from "react";
import { Login } from "./Login";
import { Unavailable } from "./Unavailable";

type Page = "login" | "unavailable";

export function App() {
  const [page, setPage] = useState<Page>("login");

  if (page === "unavailable") {
    return <Unavailable onBack={() => setPage("login")} />;
  }

  return <Login onNavigateToUnavailable={() => setPage("unavailable")} />;
}
