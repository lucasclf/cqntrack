import { z } from "zod";

// Validação client-side dos formulários de login/cadastro, só para UX (feedback
// antes do round-trip ao servidor). A validação de verdade é feita pelo better-auth
// no backend — não replicamos os contratos internos das rotas /api/auth/* aqui.
export const LoginFormSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type LoginForm = z.infer<typeof LoginFormSchema>;

export const SignupFormSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
});

export type SignupForm = z.infer<typeof SignupFormSchema>;

// DTO enxuto do que o frontend consome de session.user (better-auth já devolve um
// objeto limpo, mas isso desacopla o FE do formato exato de resposta da lib).
export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
