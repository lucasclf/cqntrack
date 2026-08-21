package xyz.cqn.cqntrack.games.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Espelha GameSummarySchema em packages/shared/src/games.ts. */
@Serializable
data class GameSummaryDto(
    val igdbId: Int,
    val name: String,
    val coverUrl: String? = null,
    val firstReleaseDate: String? = null,
    val platforms: List<String>,
    val genres: List<String>,
    val rating: Double? = null,
)

/** Espelha GameDetailSchema (GameSummarySchema + summary). */
@Serializable
data class GameDetailDto(
    val igdbId: Int,
    val name: String,
    val coverUrl: String? = null,
    val firstReleaseDate: String? = null,
    val platforms: List<String>,
    val genres: List<String>,
    val rating: Double? = null,
    val summary: String? = null,
)

/** Espelha GAME_STATUSES em packages/shared/src/games.ts (fonte única de verdade lá). */
@Serializable
enum class GameStatus {
    @SerialName("not_started") NotStarted,
    @SerialName("playing") Playing,
    @SerialName("dropped") Dropped,
    @SerialName("completed") Completed,
    @SerialName("platinum") Platinum,
}

/** Espelha GameEntrySchema. `platforms` aqui é a lista que o usuário jogou, não a da GameSummaryDto (catálogo). */
@Serializable
data class GameEntryDto(
    val id: String,
    val status: GameStatus? = null,
    val rating: Double? = null,
    val favoritedAt: String? = null,
    val platforms: List<String>? = null,
    val review: String? = null,
    val updatedAt: String,
)

@Serializable
data class SearchGamesResponseDto(
    val results: List<GameSummaryDto>,
)

@Serializable
data class GameDetailResponseDto(
    val game: GameDetailDto,
    val entry: GameEntryDto? = null,
)

@Serializable
data class UpsertGameEntryRequestDto(
    val status: GameStatus? = null,
    val rating: Double? = null,
    val review: String? = null,
    val platforms: List<String>? = null,
    val favorited: Boolean? = null,
)
