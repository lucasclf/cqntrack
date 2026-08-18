import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { clearAuthToken, getAuthToken, setAuthToken } from "./mobile-token-storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// Variante mobile de auth-client.ts (trocada via alias do Vite, ver
// vite.config.ts) — usa Bearer token em vez de cookie de sessão. O WebView
// do Capacitor serve o conteúdo local a partir de https://localhost, sem
// relação com o domínio do cookie (Domain=.cqn.xyz.br), então o cookie de
// sessão nunca chega no backend a partir do app; o plugin bearer() do
// better-auth (ver auth.ts no BE) aceita esse token no lugar do cookie.
//
// `fetchOptions.auth` manda o token em toda chamada (login incluso — o
// better-fetch só usa o valor se ele existir; no login em si ainda não há
// token, então isso não atrapalha o próprio sign-in). `onSuccess` guarda o
// token novo sempre que a resposta traz `set-auth-token` (login/cadastro/
// refresh de sessão) e limpa o token guardado quando a chamada é de
// sign-out — o servidor não reemite `set-auth-token` nesse caso (cookie
// sai com max-age 0, ver plugin bearer), então precisa ser feito aqui.
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [usernameClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => getAuthToken(),
    },
    onSuccess: async (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) {
        await setAuthToken(token);
        return;
      }
      const url = typeof ctx.request.url === "string" ? ctx.request.url : ctx.request.url.pathname;
      if (url.includes("/sign-out")) {
        await clearAuthToken();
      }
    },
  },
});
