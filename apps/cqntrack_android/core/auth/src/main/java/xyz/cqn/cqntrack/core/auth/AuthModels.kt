package xyz.cqn.cqntrack.core.auth

import kotlinx.serialization.Serializable

/** Espelha o body de POST /api/auth/sign-in/email (better-auth, plugin emailAndPassword). */
@Serializable
data class SignInRequest(
    val email: String,
    val password: String,
)

/** Espelha o body de POST /api/auth/sign-up/email (better-auth + plugin username). */
@Serializable
data class SignUpRequest(
    val name: String,
    val username: String,
    val email: String,
    val password: String,
)

/**
 * O corpo da resposta de sign-in/sign-up carrega `user`/`session`, mas o
 * único dado que este app precisa dali é o token — que não vem no corpo
 * JSON e sim no header de resposta `set-auth-token` (plugin bearer(), ver
 * auth.ts no backend). Corpo tipado como Unit: só nos importa a resposta
 * ter vindo 2xx e o header estar presente — ver AuthRepository.
 */
