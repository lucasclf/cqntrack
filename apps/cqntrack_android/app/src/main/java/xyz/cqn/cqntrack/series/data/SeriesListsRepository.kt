package xyz.cqn.cqntrack.series.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SeriesListsRepository @Inject constructor(
    private val seriesListsApi: SeriesListsApi,
) {
    suspend fun getLists(): List<SeriesListDto> = runApiCall { seriesListsApi.getLists().lists }

    suspend fun createList(body: CreateSeriesListRequestDto): SeriesListDto =
        runApiCall { seriesListsApi.createList(body) }

    suspend fun getListDetail(listId: String): SeriesListDetailDto =
        runApiCall { seriesListsApi.getListDetail(listId) }

    suspend fun updateList(listId: String, body: UpdateSeriesListRequestDto): SeriesListDto =
        runApiCall { seriesListsApi.updateList(listId, body) }

    suspend fun deleteList(listId: String) = runApiCall { seriesListsApi.deleteList(listId) }

    suspend fun addItem(listId: String, tmdbId: Int) = runApiCall { seriesListsApi.addItem(listId, tmdbId) }

    suspend fun removeItem(listId: String, tmdbId: Int) = runApiCall { seriesListsApi.removeItem(listId, tmdbId) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
