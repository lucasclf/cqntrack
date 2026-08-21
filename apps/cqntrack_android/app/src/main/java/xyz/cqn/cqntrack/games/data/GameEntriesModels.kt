package xyz.cqn.cqntrack.games.data

import kotlinx.serialization.Serializable

/** Espelha GameEntryWithGameSchema (GameEntrySchema + game) — usado na listagem "Minhas marcações". */
@Serializable
data class GameEntryWithGameDto(
    val id: String,
    val status: GameStatus? = null,
    val rating: Double? = null,
    val favoritedAt: String? = null,
    val platforms: List<String>? = null,
    val review: String? = null,
    val updatedAt: String,
    val game: GameSummaryDto,
)

@Serializable
data class PaginatedGameEntriesResponseDto(
    val items: List<GameEntryWithGameDto>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)
