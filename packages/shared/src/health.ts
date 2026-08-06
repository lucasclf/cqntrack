import { z } from "zod";

// Schema de exemplo, compartilhado entre BE e FE, para validar o contrato do endpoint de health check.
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
