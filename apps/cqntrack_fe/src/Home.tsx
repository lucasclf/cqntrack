import { HealthResponseSchema, type HealthResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setHealth(HealthResponseSchema.parse(data)))
      .catch(() => setError("Falha ao consultar o status do backend"));
  }, []);

  return (
    <main>
      <h1>cqntrack</h1>
      {error && <p role="alert">{error}</p>}
      {!error && !health && <p>Consultando status do backend...</p>}
      {health && <p>Status do backend: {health.status}</p>}
    </main>
  );
}
