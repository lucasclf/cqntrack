package xyz.cqn.cqntrack.social.data

import kotlinx.serialization.Serializable
import xyz.cqn.cqntrack.activity.data.MediaType
import kotlinx.serialization.json.JsonObject

/** Espelha FollowedUserSchema em packages/shared/src/social.ts — "usuário resumido". */
@Serializable
data class FollowedUserDto(
    val username: String,
    val displayUsername: String,
    val image: String? = null,
)

@Serializable
data class FollowingResponseDto(val items: List<FollowedUserDto>)

@Serializable
data class FollowStatusResponseDto(val following: Boolean)

/**
 * Espelha FriendActivityItemSchema — mesmo item do feed de atividade "de sempre"
 * (ActivityItemDto), só que com o autor junto (o feed de amigos mistura atividade de várias
 * pessoas). Campos duplicados de ActivityItemDto de propósito — @Serializable não suporta bem
 * "extends" de outra data class, e o corpo é pequeno o bastante pra não valer indireção aqui.
 */
@Serializable
data class FriendActivityItemDto(
    val id: String,
    val mediaType: MediaType,
    val itemId: String,
    val itemTitle: String,
    val itemHref: String,
    val itemCoverUrl: String? = null,
    val type: String,
    val metadata: JsonObject? = null,
    val createdAt: String,
    val author: FollowedUserDto,
)

@Serializable
data class FriendActivityFeedResponseDto(
    val items: List<FriendActivityItemDto>,
    val nextCursor: String? = null,
)

/** Espelha PaginatedUsersResponseSchema — aba "Procurar", diretório de outros usuários. */
@Serializable
data class PaginatedUsersResponseDto(
    val items: List<FollowedUserDto>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)
