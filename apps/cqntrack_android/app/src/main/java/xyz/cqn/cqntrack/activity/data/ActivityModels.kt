package xyz.cqn.cqntrack.activity.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Espelha MEDIA_TYPES em packages/shared/src/media-type.ts — fonte única de verdade tanto do
 * `mediaType` de cada ActivityItemDto quanto da coluna `media_type` no backend.
 */
@Serializable
enum class MediaType {
    @SerialName("games") Games,
    @SerialName("series") Series,
    @SerialName("movies") Movies,
    @SerialName("books") Books,
    @SerialName("manga") Manga,
}

/**
 * Espelha ActivityItemSchema em packages/shared/src/activity.ts — log de atividade genérico
 * entre seções, já com snapshot pronto pra exibição (itemTitle/itemHref/itemCoverUrl). `type` é
 * vocabulário livre por seção (ver DescribeActivity.kt), `metadata` cru — cada `type` sabe quais
 * chaves esperar dali.
 */
@Serializable
data class ActivityItemDto(
    val id: String,
    val mediaType: MediaType,
    val itemId: String,
    val itemTitle: String,
    val itemHref: String,
    val itemCoverUrl: String? = null,
    val type: String,
    val metadata: JsonObject? = null,
    val createdAt: String,
)

@Serializable
data class ActivityFeedResponseDto(
    val items: List<ActivityItemDto>,
    val nextCursor: String? = null,
)
