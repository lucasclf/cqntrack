package xyz.cqn.cqntrack.books.data

import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
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

    /**
     * Mesma rota de [upsertEntry], mas com corpo montado à mão em vez do DTO
     * tipado — o `Json` global usa `explicitNulls = false` (necessário pra
     * updates parciais tipados não mandarem os outros campos como `null`),
     * o que também impede mandar um `null` explícito de propósito (limpar
     * nota/review). Um `JsonObject` já montado ignora essa configuração —
     * o valor `JsonNull` que a gente decide colocar ali vai sempre serializado.
     */
    @PUT("api/books/{googleBooksId}/entry")
    suspend fun upsertEntryRaw(
        @Path("googleBooksId") googleBooksId: String,
        @Body body: JsonObject,
    ): BookEntryDto

    @DELETE("api/books/{googleBooksId}/entry")
    suspend fun deleteEntry(@Path("googleBooksId") googleBooksId: String)
}
