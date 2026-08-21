package xyz.cqn.cqntrack.books.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/books/books.routes.ts, montado em /api/books. */
interface BooksApi {
    @GET("api/books/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchBooksResponseDto

    @GET("api/books/{googleBooksId}")
    suspend fun getDetail(@Path("googleBooksId") googleBooksId: String): BookDetailResponseDto

    @PUT("api/books/{googleBooksId}/entry")
    suspend fun upsertEntry(
        @Path("googleBooksId") googleBooksId: String,
        @Body body: UpsertBookEntryRequestDto,
    ): BookEntryDto
}
