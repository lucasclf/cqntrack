import { Preferences } from "@capacitor/preferences";

// Só usado no build mobile (ver alias condicional em vite.config.ts) —
// guarda o bearer token emitido no login em storage nativo persistente
// (sobrevive a fechar o app), já que não há cookie de sessão disponível
// dentro do WebView do Capacitor (ver auth-client.mobile.ts pro porquê).
const TOKEN_KEY = "cqntrack_auth_token";

export async function getAuthToken(): Promise<string | undefined> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value ?? undefined;
}

export async function setAuthToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearAuthToken(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY });
}
