package xyz.cqn.cqntrack.games.data

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GamesRepository @Inject constructor(
    private val gamesApi: GamesApi,
) {
    suspend fun search(query: String): List<GameSummaryDto> =
        runApiCall { gamesApi.search(query).results }

    suspend fun getDetail(igdbId: Int): GameDetailResponseDto =
        runApiCall { gamesApi.getDetail(igdbId) }

    suspend fun discover(page: Int, platform: GameDiscoverPlatform?): DiscoverGamesResponseDto =
        runApiCall { gamesApi.discover(page, platform?.apiValue) }

    suspend fun upsertEntry(igdbId: Int, body: UpsertGameEntryRequestDto): GameEntryDto =
        runApiCall { gamesApi.upsertEntry(igdbId, body) }

    suspend fun setRating(igdbId: Int, rating: Double?): GameEntryDto =
        runApiCall { gamesApi.upsertEntryRaw(igdbId, buildJsonObject { put("rating", rating) }) }

    suspend fun setReview(igdbId: Int, review: String?): GameEntryDto =
        runApiCall { gamesApi.upsertEntryRaw(igdbId, buildJsonObject { put("review", review) }) }

    /** `null` limpa a lista de plataformas jogadas (mesma lógica de setRating/setReview — precisa de null explícito). */
    suspend fun setPlatforms(igdbId: Int, platforms: List<String>?): GameEntryDto =
        runApiCall {
            val body = buildJsonObject {
                if (platforms == null) {
                    put("platforms", JsonNull)
                } else {
                    putJsonArray("platforms") { platforms.forEach { add(it) } }
                }
            }
            gamesApi.upsertEntryRaw(igdbId, body)
        }

    suspend fun deleteEntry(igdbId: Int) = runApiCall { gamesApi.deleteEntry(igdbId) }

    suspend fun getEntries(
        status: GameStatus?,
        favorite: Boolean?,
        platform: String?,
        sortBy: String,
        order: String,
        page: Int,
    ): PaginatedGameEntriesResponseDto = runApiCall {
        gamesApi.getEntries(status?.toApiValue(), favorite, platform, sortBy, order, page)
    }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}

private fun GameStatus.toApiValue(): String = when (this) {
    GameStatus.NotStarted -> "not_started"
    GameStatus.Playing -> "playing"
    GameStatus.Dropped -> "dropped"
    GameStatus.Completed -> "completed"
    GameStatus.Platinum -> "platinum"
}
