package xyz.cqn.cqntrack.profile.data

import kotlinx.serialization.Serializable

/** Espelha AuthUserSchema em packages/shared/src/auth.ts — resposta de GET /api/me. */
@Serializable
data class AuthUserDto(
    val id: String,
    val name: String,
    val email: String,
    val username: String,
    val displayUsername: String,
)

/**
 * Espelha PublicProfileSchema — resposta de GET /api/users/:username, sem
 * sessão (perfil público, ver comentário em users.routes.ts no backend).
 * Sem stats agregados nem favoritos aqui — só identidade; cada seção tem seu
 * próprio endpoint de favoritos (GET /api/users/:username/<seção>/favorites),
 * fora do escopo desta primeira versão do perfil no app nativo.
 */
@Serializable
data class PublicProfileDto(
    val username: String,
    val displayUsername: String,
    val memberSince: String,
    val image: String? = null,
)

/** Espelha UploadAvatarResponseSchema — resposta de PUT /api/me/avatar. */
@Serializable
data class UploadAvatarResponseDto(val url: String)
