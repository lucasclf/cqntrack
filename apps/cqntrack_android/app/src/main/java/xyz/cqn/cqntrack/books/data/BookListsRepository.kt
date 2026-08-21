package xyz.cqn.cqntrack.books.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BookListsRepository @Inject constructor(
    private val bookListsApi: BookListsApi,
) {
    suspend fun getLists(): List<BookListDto> = runApiCall { bookListsApi.getLists().lists }

    suspend fun createList(body: CreateBookListRequestDto): BookListDto =
        runApiCall { bookListsApi.createList(body) }

    suspend fun getListDetail(listId: String): BookListDetailDto =
        runApiCall { bookListsApi.getListDetail(listId) }

    suspend fun updateList(listId: String, body: UpdateBookListRequestDto): BookListDto =
        runApiCall { bookListsApi.updateList(listId, body) }

    suspend fun deleteList(listId: String) = runApiCall { bookListsApi.deleteList(listId) }

    suspend fun addItem(listId: String, googleBooksId: String) =
        runApiCall { bookListsApi.addItem(listId, googleBooksId) }

    suspend fun removeItem(listId: String, googleBooksId: String) =
        runApiCall { bookListsApi.removeItem(listId, googleBooksId) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
