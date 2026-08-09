import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [usernameClient()],
});
