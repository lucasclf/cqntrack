import { GoogleBooksRequestError, googleBooksFetch } from "./client";
import type { GoogleBooksSearchResponse, GoogleBooksVolume } from "./types";

export async function searchBooks(
  env: Env,
  query: string,
  limit = 20,
): Promise<GoogleBooksVolume[]> {
  const safeQuery = encodeURIComponent(query.slice(0, 100));
  const safeLimit = Math.min(Math.max(limit, 1), 40);
  const response = await googleBooksFetch<GoogleBooksSearchResponse>(
    env,
    `/volumes?q=${safeQuery}&maxResults=${safeLimit}`,
  );
  return response.items ?? [];
}

export async function getBookById(
  env: Env,
  googleBooksId: string,
): Promise<GoogleBooksVolume | null> {
  try {
    return await googleBooksFetch<GoogleBooksVolume>(env, `/volumes/${googleBooksId}`);
  } catch (error) {
    if (error instanceof GoogleBooksRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
