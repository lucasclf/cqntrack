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

/** Espelha DiscoverGamesResponseSchema — aclamados reais via GET /api/games/discover. */
@Serializable
data class DiscoverGamesResponseDto(
    val results: List<GameSummaryDto>,
    val page: Int,
    val hasMore: Boolean,
)

/**
 * Espelha GAME_DISCOVER_PLATFORMS em packages/shared/src/games.ts — conjunto fixo e curto de
 * plataformas populares (não a lista completa da IGDB), só o contrato slug/label entre o app e o
 * backend. Diferente de GameEntryDto.platforms (plataformas que o usuário jogou) — este filtra o
 * catálogo de aclamados em si (GET /api/games/discover?platform=...).
 */
@Serializable
enum class GameDiscoverPlatform(val apiValue: String, val label: String) {
    @SerialName("ps5") Ps5("ps5", "PS5"),
    @SerialName("ps4") Ps4("ps4", "PS4"),
    @SerialName("xbox-series") XboxSeries("xbox-series", "Xbox Series"),
    @SerialName("xbox-one") XboxOne("xbox-one", "Xbox One"),
    @SerialName("switch2") Switch2("switch2", "Switch 2"),
    @SerialName("switch") Switch("switch", "Switch"),
    @SerialName("pc") Pc("pc", "PC"),
    @SerialName("mobile") Mobile("mobile", "Mobile"),
}

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
