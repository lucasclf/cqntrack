import { createAuthClient } from "better-auth/react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
});
