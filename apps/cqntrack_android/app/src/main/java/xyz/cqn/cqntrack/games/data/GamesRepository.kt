package xyz.cqn.cqntrack.games.data

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

    suspend fun discover(page: Int): DiscoverGamesResponseDto =
        runApiCall { gamesApi.discover(page) }

    suspend fun upsertEntry(igdbId: Int, body: UpsertGameEntryRequestDto): GameEntryDto =
        runApiCall { gamesApi.upsertEntry(igdbId, body) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
