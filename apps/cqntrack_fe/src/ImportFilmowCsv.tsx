import type { ImportFilmowResponse, ImportFilmowResult } from "@cqntrack/shared";
import { type ChangeEvent, useState } from "react";
import styles from "./ImportFilmowCsv.module.css";
import { apiClient } from "./lib/api-client";
import { parseCsv } from "./lib/parseCsv";

// Lote pequeno o bastante pra cada request ao backend ficar bem abaixo do
// limite de subrequests do Worker (cada título novo custa ~3 lá dentro:
// busca + detalhe + créditos na TMDB) — ver ImportFilmowRequestSchema
// (max 30 por request; 20 aqui dá folga).
const BATCH_SIZE = 20;

type ImportStatus = "idle" | "reading" | "importing" | "done" | "error";

function extractTitles(csvText: string): string[] | null {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return null;

  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const titleIndex = header.indexOf("title");
  if (titleIndex === -1) return null;

  return rows
    .slice(1)
    .map((row) => row[titleIndex]?.trim())
    .filter((title): title is string => Boolean(title));
}

// "Conta" > "Importar dados" > CSV do Filmow — lê o arquivo no navegador
// (sem upload de arquivo em si, só o texto), extrai a coluna "Title" e
// manda em lotes pro backend, que busca cada título na TMDB e marca como
// "Já vi" quando encontra. Título não encontrado fica na lista de
// pendências pro usuário resolver manualmente.
export function ImportFilmowCsv() {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportFilmowResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runImport(titles: string[]) {
    setStatus("importing");
    setProgress({ done: 0, total: titles.length });
    setResults([]);

    const collected: ImportFilmowResult[] = [];
    for (let start = 0; start < titles.length; start += BATCH_SIZE) {
      const batch = titles.slice(start, start + BATCH_SIZE);
      try {
        const response = await apiClient.post<ImportFilmowResponse>("/api/movies/import/filmow", {
          titles: batch,
        });
        collected.push(...response.results);
      } catch {
        for (const title of batch) {
          collected.push({ title, status: "error", movie: null });
        }
      }
      setProgress({ done: Math.min(start + BATCH_SIZE, titles.length), total: titles.length });
      setResults([...collected]);
    }

    setStatus("done");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setStatus("reading");

    const text = await file.text();
    const titles = extractTitles(text);

    if (!titles) {
      setStatus("error");
      setError('O CSV precisa ter uma coluna "Title".');
      return;
    }
    if (titles.length === 0) {
      setStatus("error");
      setError("Nenhum título encontrado no CSV.");
      return;
    }

    await runImport(titles);
  }

  const imported = results.filter((r) => r.status === "imported").length;
  const notFound = results.filter((r) => r.status === "not_found");
  const errored = results.filter((r) => r.status === "error");
  const busy = status === "reading" || status === "importing";

  return (
    <div className={styles.card}>
      <h3>Filmes assistidos (Filmow, CSV)</h3>
      <p className={styles.hint}>
        Exporte sua lista de "Já vistos" do Filmow como CSV (coluna "Title") e importe aqui — cada
        filme encontrado é marcado como "Já vi". Título sem correspondência na TMDB fica numa lista
        pra você adicionar manualmente depois.
      </p>

      <label className={styles.fileLabel}>
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={busy} />
        {busy ? "Importando..." : "Escolher arquivo CSV"}
      </label>

      {status === "reading" && <p className={styles.hint}>Lendo o arquivo...</p>}
      {status === "importing" && (
        <p className={styles.hint}>
          Importando {progress.done} de {progress.total}...
        </p>
      )}
      {status === "error" && <p role="alert">{error}</p>}

      {status === "done" && (
        <div className={styles.summary}>
          <p>
            <strong>{imported}</strong> {imported === 1 ? "filme importado" : "filmes importados"}{" "}
            como "Já vi".
          </p>
          {errored.length > 0 && (
            <div role="alert">
              <p>
                {errored.length} {errored.length === 1 ? "título falhou" : "títulos falharam"} ao
                importar — importe o CSV de novo pra tentar esses de novo.
              </p>
              <details>
                <summary>
                  Ver {errored.length === 1 ? "o título que falhou" : "os títulos que falharam"}
                </summary>
                <ul className={styles.notFoundList}>
                  {errored.map((result, index) => (
                    <li key={`${result.title}-${index}`}>{result.title}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
          {notFound.length > 0 && (
            <details>
              <summary>
                {notFound.length} {notFound.length === 1 ? "não encontrado" : "não encontrados"}
              </summary>
              <ul className={styles.notFoundList}>
                {notFound.map((result, index) => (
                  <li key={`${result.title}-${index}`}>{result.title}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
