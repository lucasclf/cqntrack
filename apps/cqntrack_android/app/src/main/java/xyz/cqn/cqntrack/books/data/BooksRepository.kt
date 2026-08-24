package xyz.cqn.cqntrack.books.data

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
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

    suspend fun setRating(googleBooksId: String, rating: Double?): BookEntryDto =
        runApiCall { booksApi.upsertEntryRaw(googleBooksId, buildJsonObject { put("rating", rating) }) }

    suspend fun setReview(googleBooksId: String, review: String?): BookEntryDto =
        runApiCall { booksApi.upsertEntryRaw(googleBooksId, buildJsonObject { put("review", review) }) }

    suspend fun deleteEntry(googleBooksId: String) = runApiCall { booksApi.deleteEntry(googleBooksId) }

    suspend fun getEntries(
        status: BookStatus?,
        favorite: Boolean?,
        sortBy: String,
        order: String,
        page: Int,
    ): PaginatedBookEntriesResponseDto = runApiCall {
        booksApi.getEntries(status?.toApiValue(), favorite, sortBy, order, page)
    }

    suspend fun getAuthor(name: String): AuthorBooksResponseDto = runApiCall { booksApi.getAuthor(name) }

    /** Traduz HttpException (Retrofit) pra ApiException (:core:network) — mesmo formato de erro em todo o app, não só em books. */
    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}

/** Valor de query string — mesmo texto do @SerialName usado no corpo JSON. */
private fun BookStatus.toApiValue(): String = when (this) {
    BookStatus.WantToRead -> "want_to_read"
    BookStatus.Reading -> "reading"
    BookStatus.Read -> "read"
    BookStatus.Dropped -> "dropped"
}
