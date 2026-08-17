import type { ImportTvTimeEpisode, ImportTvTimeResponse } from "@cqntrack/shared";
import { type ChangeEvent, useState } from "react";
import styles from "./ImportTvTimeCsv.module.css";
import { apiClient } from "./lib/api-client";
import { parseCsv, rowsToCsv } from "./lib/parseCsv";

// Diferente do Filmow (1 linha = 1 filme), o export do tvtime é por
// EPISÓDIO (1 linha por episódio de cada série) — agrupar por série antes
// de mandar reduz um CSV de milhares de linhas pra dezenas/centenas de
// requests. 1 série por request (mesmo racional de BATCH_SIZE em
// ImportFilmowCsv.tsx: o plano Free de Workers só dá 10ms de CPU por
// invocação), mas cada request já cobre TODOS os episódios assistidos
// daquela série de uma vez (ver import.service.ts no backend).
const REQUIRED_COLUMNS = [
  "series_tvdb_id",
  "title",
  "season",
  "episode",
  "is_watched",
  "watched_at",
] as const;

type ImportStatus = "idle" | "reading" | "importing" | "done" | "error";

interface Columns {
  seriesTvdbId: number;
  title: number;
  season: number;
  episode: number;
  isWatched: number;
  watchedAt: number;
}

function findColumns(header: string[]): Columns | null {
  const normalized = header.map((cell) => cell.trim().toLowerCase());
  const [seriesTvdbId, title, season, episode, isWatched, watchedAt] = REQUIRED_COLUMNS.map(
    (name) => normalized.indexOf(name),
  );
  if ([seriesTvdbId, title, season, episode, isWatched, watchedAt].includes(-1)) {
    return null;
  }
  return {
    seriesTvdbId: seriesTvdbId!,
    title: title!,
    season: season!,
    episode: episode!,
    isWatched: isWatched!,
    watchedAt: watchedAt!,
  };
}

interface SeriesGroup {
  seriesTvdbId: number;
  title: string;
  // Linhas originais completas (assistidas ou não) — só usadas pra
  // reconstruir o CSV de reimport das séries que falharem, nunca mandadas
  // pro backend.
  rows: string[][];
  episodes: ImportTvTimeEpisode[];
}

// Agrupa as linhas do CSV por série, filtrando só `is_watched=true` pros
// episódios que de fato entram no request. Linha sem series_tvdb_id
// numérico não tem como ser resolvida na TMDB (ver findSeriesByTvdbId no
// backend) e vira "inválida" sem gastar request nenhuma.
function groupBySeries(
  rows: string[][],
  columns: Columns,
): { groups: SeriesGroup[]; invalidRows: string[][] } {
  const groups = new Map<number, SeriesGroup>();
  const invalidRows: string[][] = [];

  for (const row of rows) {
    const rawTvdbId = row[columns.seriesTvdbId]?.trim();
    const tvdbId = rawTvdbId ? Number(rawTvdbId) : Number.NaN;
    if (!Number.isInteger(tvdbId) || tvdbId <= 0) {
      invalidRows.push(row);
      continue;
    }

    let group = groups.get(tvdbId);
    if (!group) {
      group = {
        seriesTvdbId: tvdbId,
        title: row[columns.title]?.trim() ?? "",
        rows: [],
        episodes: [],
      };
      groups.set(tvdbId, group);
    }
    group.rows.push(row);

    if (row[columns.isWatched]?.trim().toLowerCase() !== "true") {
      continue;
    }

    const season = Number(row[columns.season]);
    const episode = Number(row[columns.episode]);
    if (!Number.isInteger(season) || !Number.isInteger(episode)) {
      continue;
    }

    const watchedAtRaw = row[columns.watchedAt]?.trim();
    group.episodes.push({ season, episode, watchedAt: watchedAtRaw ? watchedAtRaw : null });
  }

  return { groups: [...groups.values()], invalidRows };
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const blob = new Blob([rowsToCsv(header, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// "Conta" > "Importar dados" > CSV do tvtime — lê o arquivo no navegador,
// agrupa as linhas (1 por episódio) por série e manda 1 request por série
// pro backend, que resolve o tvdb_id na TMDB e marca todos os episódios
// assistidos daquela série de uma vez.
export function ImportTvTimeCsv() {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportTvTimeResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<string[][]>([]);
  const [rowsBySeries, setRowsBySeries] = useState<Map<number, string[][]>>(new Map());

  async function runImport(groups: SeriesGroup[]) {
    setStatus("importing");
    setProgress({ done: 0, total: groups.length });

    const collected: ImportTvTimeResponse[] = [];
    setResults([]);

    for (const group of groups) {
      try {
        const response = await apiClient.post<ImportTvTimeResponse>("/api/series/import/tvtime", {
          seriesTvdbId: group.seriesTvdbId,
          title: group.title,
          episodes: group.episodes,
        });
        collected.push(response);
      } catch {
        collected.push({
          seriesTvdbId: group.seriesTvdbId,
          title: group.title,
          status: "error",
          episodesImported: 0,
        });
      }
      setProgress({ done: collected.length, total: groups.length });
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
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setStatus("error");
      setError("Nenhuma linha encontrada no CSV.");
      return;
    }

    const csvHeader = rows[0]!;
    const columns = findColumns(csvHeader);
    if (!columns) {
      setStatus("error");
      setError(
        `O CSV precisa ter as colunas ${REQUIRED_COLUMNS.map((name) => `"${name}"`).join(", ")}.`,
      );
      return;
    }

    const { groups, invalidRows: invalid } = groupBySeries(rows.slice(1), columns);
    // Série sem nenhum episódio assistido não tem o que importar — não
    // gera request.
    const importable = groups.filter((group) => group.episodes.length > 0);

    setHeader(csvHeader);
    setInvalidRows(invalid);
    setRowsBySeries(new Map(groups.map((group) => [group.seriesTvdbId, group.rows])));

    if (importable.length === 0) {
      setStatus("error");
      setError(
        invalid.length > 0
          ? "Nenhum episódio assistido encontrado no CSV (e algumas linhas não têm series_tvdb_id válido)."
          : "Nenhum episódio assistido encontrado no CSV.",
      );
      return;
    }

    await runImport(importable);
  }

  const imported = results.filter((r) => r.status === "imported");
  const notFound = results.filter((r) => r.status === "not_found");
  const errored = results.filter((r) => r.status === "error");
  const totalEpisodesImported = imported.reduce((sum, r) => sum + r.episodesImported, 0);
  const busy = status === "reading" || status === "importing";

  function downloadFailed() {
    const erroredRows = errored.flatMap((r) => rowsBySeries.get(r.seriesTvdbId) ?? []);
    downloadCsv("tvtime-series-com-erro.csv", header, [...erroredRows, ...invalidRows]);
  }

  return (
    <div className={styles.card}>
      <h3>Episódios assistidos (tvtime, CSV)</h3>
      <p className={styles.hint}>
        Exporte seu histórico do tvtime como CSV e importe aqui — cada série é resolvida na TMDB e
        todos os episódios marcados como assistidos no tvtime entram de uma vez. Série sem
        correspondência na TMDB fica numa lista pra você resolver manualmente depois.
      </p>

      <label className={styles.fileLabel}>
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={busy} />
        {busy ? "Importando..." : "Escolher arquivo CSV"}
      </label>

      {status === "reading" && <p className={styles.hint}>Lendo o arquivo...</p>}
      {status === "importing" && (
        <p className={styles.hint}>
          Importando série {progress.done} de {progress.total}...
        </p>
      )}
      {status === "error" && <p role="alert">{error}</p>}

      {status === "done" && (
        <div className={styles.summary}>
          <p>
            <strong>{imported.length}</strong>{" "}
            {imported.length === 1 ? "série importada" : "séries importadas"} (
            <strong>{totalEpisodesImported}</strong>{" "}
            {totalEpisodesImported === 1 ? "episódio marcado" : "episódios marcados"} como "Já vi").
          </p>
          {errored.length > 0 && (
            <div role="alert">
              <p>
                {errored.length} {errored.length === 1 ? "série falhou" : "séries falharam"} ao
                importar.
              </p>
              <button type="button" className={styles.downloadButton} onClick={downloadFailed}>
                Baixar CSV com{" "}
                {errored.length === 1 ? "a série que falhou" : "as séries que falharam"}
              </button>
              <details>
                <summary>
                  Ver {errored.length === 1 ? "a série que falhou" : "as séries que falharam"}
                </summary>
                <ul className={styles.notFoundList}>
                  {errored.map((result) => (
                    <li key={result.seriesTvdbId}>{result.title}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
          {notFound.length > 0 && (
            <details>
              <summary>
                {notFound.length} {notFound.length === 1 ? "não encontrada" : "não encontradas"} na
                TMDB
              </summary>
              <ul className={styles.notFoundList}>
                {notFound.map((result) => (
                  <li key={result.seriesTvdbId}>{result.title}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
