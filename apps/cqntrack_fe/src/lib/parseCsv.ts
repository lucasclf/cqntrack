// Parser de CSV mínimo (RFC 4180): campos entre aspas podem conter vírgula
// e quebra de linha; "" dentro de um campo entre aspas vira um " literal.
// Suficiente pro export do Filmow (só a coluna "Title", mas alguns títulos
// têm vírgula, ex. "Three Billboards Outside Ebbing, Missouri") sem puxar
// uma lib externa pra isso.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Por RFC 4180, aspas só abrem um campo cotado quando são o primeiro
  // caractere do campo — no meio de um campo já iniciado é só um caractere
  // literal. Sem esse controle, uma aspa solta (comum em exports com
  // encoding quebrado) faria o parser "engolir" vírgulas e quebras de linha
  // de todas as linhas seguintes até achar outra aspa, corrompendo o resto
  // do arquivo inteiro.
  let atFieldStart = true;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
    } else if (char === ",") {
      row.push(field);
      field = "";
      atFieldStart = true;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atFieldStart = true;
    } else {
      field += char;
      atFieldStart = false;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cols) => cols.some((col) => col.trim().length > 0));
}

// Lado inverso do parser acima — só entre aspas (e dobra aspas internas)
// quando o campo realmente precisa (contém vírgula, aspas ou quebra de
// linha), pra gerar um CSV legível que o próprio parseCsv (e o Filmow) lê
// de volta sem ambiguidade.
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Formato de saída igual ao de entrada esperado por ImportFilmowCsv (uma
// coluna "Title") — usado pra gerar o CSV de reexportação dos títulos que
// falharam mesmo depois das tentativas de novo.
export function titlesToCsv(titles: string[]): string {
  return ["Title", ...titles.map(escapeCsvField)].join("\r\n");
}
