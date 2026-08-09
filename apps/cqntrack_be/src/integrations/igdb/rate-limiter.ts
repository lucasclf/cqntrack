// Limite real da IGDB: 4 requisições/segundo. Janela fixa por isolate
// (best-effort — não é um limite global entre isolates distintos, mas é
// suficiente para o volume de um app pessoal; o risco real de estourar isso
// é digitação rápida na busca, mitigado com debounce no frontend).
const MAX_REQUESTS_PER_WINDOW = 4;
const WINDOW_MS = 1000;

let windowStart = 0;
let requestsInWindow = 0;

export async function waitForRateLimitSlot(): Promise<void> {
  const now = Date.now();

  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    requestsInWindow = 0;
  }

  if (requestsInWindow < MAX_REQUESTS_PER_WINDOW) {
    requestsInWindow += 1;
    return;
  }

  const waitMs = WINDOW_MS - (now - windowStart);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  await waitForRateLimitSlot();
}

// Só para testes: evita que o estado da janela vaze de um teste pro outro.
export function resetRateLimiter(): void {
  windowStart = 0;
  requestsInWindow = 0;
}
