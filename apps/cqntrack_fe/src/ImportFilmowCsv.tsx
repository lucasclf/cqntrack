import type { ImportFilmowResponse, ImportFilmowResult } from "@cqntrack/shared";
import { type ChangeEvent, useState } from "react";
import styles from "./ImportFilmowCsv.module.css";
import { apiClient } from "./lib/api-client";
import { parseCsv, titlesToCsv } from "./lib/parseCsv";

// 1 título por request — o plano Free de Workers tem só 10ms de CPU por
// invocação, e processar um filme novo (busca + detalhe na TMDB, validação,
// gravação no D1, em cima do custo fixo de verificar a sessão) já é
// suficiente pra estourar esse teto às vezes. Sem retry: se um título falhar
// (rede, ou o Worker estourando o limite de CPU), ele já sai marcado como
// erro na hora — tentar de novo raramente ajuda porque a causa costuma ser
// o mesmo teto de CPU, não algo transitório. O usuário baixa um CSV só com
// quem falhou (ver downloadErroredCsv) e reimporta depois.
const BATCH_SIZE = 1;

// Mesmo limite de ImportFilmowRequestSchema (título até 300 caracteres).
// Filtrado aqui, antes de montar os lotes, pra um título gigante/corrompido
// (ex.: CSV com encoding quebrado) não derrubar o request na validação do
// backend — vira "error" na hora, sem gastar request nenhuma.
const MAX_TITLE_LENGTH = 300;

type ImportStatus = "idle" | "reading" | "importing" | "done" | "error";

// Baixa um CSV no mesmo formato aceito por ImportFilmowCsv (coluna
// "Title") com só os títulos que falharam, pro usuário poder tentar de
// novo mais tarde (ex.: depois de mais filmes da lista já estarem
// cacheados, o que reduz o trabalho por request) sem precisar separar isso
// à mão do CSV original.
function downloadErroredCsv(titles: string[]) {
  const blob = new Blob([titlesToCsv(titles)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "filmow-titulos-com-erro.csv";
  link.click();
  URL.revokeObjectURL(url);
}

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
    const validTitles = titles.filter((title) => title.length <= MAX_TITLE_LENGTH);
    const oversized = titles.filter((title) => title.length > MAX_TITLE_LENGTH);

    setStatus("importing");
    setProgress({ done: oversized.length, total: titles.length });

    const collected: ImportFilmowResult[] = oversized.map((title) => ({
      title,
      status: "error",
      movie: null,
    }));
    setResults([...collected]);

    for (let start = 0; start < validTitles.length; start += BATCH_SIZE) {
      const batch = validTitles.slice(start, start + BATCH_SIZE);
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
      setProgress({
        done: oversized.length + Math.min(start + BATCH_SIZE, validTitles.length),
        total: titles.length,
      });
      setResults([...collected]);
    }

    // Resumo agregado, não 1 por título (ver logFilmowImportActivity no
    // backend — o import em si roda com logActivity: false de propósito).
    // Melhor esforço: falha aqui não deve travar a tela de resultado.
    const importedCount = collected.filter((result) => result.status === "imported").length;
    if (importedCount > 0) {
      apiClient.post("/api/movies/import/filmow/activity", { importedCount }).catch(() => {});
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
                importar.
              </p>
              <button
                type="button"
                className={styles.downloadButton}
                onClick={() => downloadErroredCsv(errored.map((result) => result.title))}
              >
                Baixar CSV com{" "}
                {errored.length === 1 ? "o título que falhou" : "os títulos que falharam"}
              </button>
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
