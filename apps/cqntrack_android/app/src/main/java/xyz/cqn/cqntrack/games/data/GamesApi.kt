package xyz.cqn.cqntrack.games.data

import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/games/games.routes.ts, montado em /api/games. */
interface GamesApi {
    @GET("api/games/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchGamesResponseDto

    @GET("api/games/discover")
    suspend fun discover(@Query("page") page: Int = 1): DiscoverGamesResponseDto

    @GET("api/games/{igdbId}")
    suspend fun getDetail(@Path("igdbId") igdbId: Int): GameDetailResponseDto

    @PUT("api/games/{igdbId}/entry")
    suspend fun upsertEntry(
        @Path("igdbId") igdbId: Int,
        @Body body: UpsertGameEntryRequestDto,
    ): GameEntryDto

    /** Ver comentário equivalente em BooksApi.kt — corpo cru pra permitir limpar nota/review com null explícito. */
    @PUT("api/games/{igdbId}/entry")
    suspend fun upsertEntryRaw(@Path("igdbId") igdbId: Int, @Body body: JsonObject): GameEntryDto

    @DELETE("api/games/{igdbId}/entry")
    suspend fun deleteEntry(@Path("igdbId") igdbId: Int)

    /** Espelha ListGameEntriesQuerySchema — "Minhas marcações". Sem platform/excludeNotStarted nesta versão. */
    @GET("api/games/entries")
    suspend fun getEntries(
        @Query("status") status: String? = null,
        @Query("favorite") favorite: Boolean? = null,
        @Query("sortBy") sortBy: String = "updatedAt",
        @Query("order") order: String = "desc",
        @Query("page") page: Int = 1,
    ): PaginatedGameEntriesResponseDto
}
