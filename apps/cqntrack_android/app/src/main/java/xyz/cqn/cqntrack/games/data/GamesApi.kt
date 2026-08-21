package xyz.cqn.cqntrack.games.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/games/games.routes.ts, montado em /api/games. */
interface GamesApi {
    @GET("api/games/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchGamesResponseDto

    @GET("api/games/{igdbId}")
    suspend fun getDetail(@Path("igdbId") igdbId: Int): GameDetailResponseDto

    @PUT("api/games/{igdbId}/entry")
    suspend fun upsertEntry(
        @Path("igdbId") igdbId: Int,
        @Body body: UpsertGameEntryRequestDto,
    ): GameEntryDto
}
