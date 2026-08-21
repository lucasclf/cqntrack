package xyz.cqn.cqntrack.games.data

import kotlinx.serialization.Serializable

/** Espelha GameListSchema em packages/shared/src/games.ts. */
@Serializable
data class GameListDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class GameListsResponseDto(
    val lists: List<GameListDto>,
)

/** Espelha GameListDetailSchema (GameListSchema + items). */
@Serializable
data class GameListDetailDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
    val items: List<GameSummaryDto>,
)

@Serializable
data class CreateGameListRequestDto(
    val name: String,
    val description: String? = null,
)

@Serializable
data class UpdateGameListRequestDto(
    val name: String? = null,
    val description: String? = null,
)
