package xyz.cqn.cqntrack.games.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameListsRepository @Inject constructor(
    private val gameListsApi: GameListsApi,
) {
    suspend fun getLists(): List<GameListDto> = runApiCall { gameListsApi.getLists().lists }

    suspend fun createList(body: CreateGameListRequestDto): GameListDto =
        runApiCall { gameListsApi.createList(body) }

    suspend fun getListDetail(listId: String): GameListDetailDto =
        runApiCall { gameListsApi.getListDetail(listId) }

    suspend fun updateList(listId: String, body: UpdateGameListRequestDto): GameListDto =
        runApiCall { gameListsApi.updateList(listId, body) }

    suspend fun deleteList(listId: String) = runApiCall { gameListsApi.deleteList(listId) }

    suspend fun addItem(listId: String, igdbId: Int) = runApiCall { gameListsApi.addItem(listId, igdbId) }

    suspend fun removeItem(listId: String, igdbId: Int) = runApiCall { gameListsApi.removeItem(listId, igdbId) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
