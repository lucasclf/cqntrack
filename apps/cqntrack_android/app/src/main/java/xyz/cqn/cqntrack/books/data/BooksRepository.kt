package xyz.cqn.cqntrack.books.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BooksRepository @Inject constructor(
    private val booksApi: BooksApi,
) {
    suspend fun search(query: String): List<BookSummaryDto> =
        runApiCall { booksApi.search(query).results }

    suspend fun getDetail(googleBooksId: String): BookDetailResponseDto =
        runApiCall { booksApi.getDetail(googleBooksId) }

    suspend fun upsertEntry(googleBooksId: String, body: UpsertBookEntryRequestDto): BookEntryDto =
        runApiCall { booksApi.upsertEntry(googleBooksId, body) }

    /** Traduz HttpException (Retrofit) pra ApiException (:core:network) — mesmo formato de erro em todo o app, não só em books. */
    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
