package xyz.cqn.cqntrack.manga.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MangaListsRepository @Inject constructor(
    private val mangaListsApi: MangaListsApi,
) {
    suspend fun getLists(): List<MangaListDto> = runApiCall { mangaListsApi.getLists().lists }

    suspend fun createList(body: CreateMangaListRequestDto): MangaListDto =
        runApiCall { mangaListsApi.createList(body) }

    suspend fun getListDetail(listId: String): MangaListDetailDto =
        runApiCall { mangaListsApi.getListDetail(listId) }

    suspend fun updateList(listId: String, body: UpdateMangaListRequestDto): MangaListDto =
        runApiCall { mangaListsApi.updateList(listId, body) }

    suspend fun deleteList(listId: String) = runApiCall { mangaListsApi.deleteList(listId) }

    suspend fun addItem(listId: String, mangadexId: String) =
        runApiCall { mangaListsApi.addItem(listId, mangadexId) }

    suspend fun removeItem(listId: String, mangadexId: String) =
        runApiCall { mangaListsApi.removeItem(listId, mangadexId) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
