import { z } from "zod";

// Genérico entre seções — cada seção tem seus próprios 4 slots de favorito
// (não é um pool único misturando tipos de mídia), mas o "formato" do slot em
// si (1-4) é o mesmo em qualquer seção. Cada seção define seu próprio
// FavoriteSlotSchema/FavoritesResponseSchema (a entry embutida tem formato
// diferente por seção) — só o número do slot mora aqui.
export const FAVORITE_SLOTS = [1, 2, 3, 4] as const;

export const FavoriteSlotNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export type FavoriteSlotNumber = z.infer<typeof FavoriteSlotNumberSchema>;
