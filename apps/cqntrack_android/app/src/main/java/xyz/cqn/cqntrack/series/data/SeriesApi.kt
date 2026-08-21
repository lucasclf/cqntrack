package xyz.cqn.cqntrack.series.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/series/series.routes.ts, montado em /api/series. */
interface SeriesApi {
    @GET("api/series/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchSeriesResponseDto

    @GET("api/series/{tmdbId}")
    suspend fun getDetail(@Path("tmdbId") tmdbId: Int): SeriesDetailResponseDto

    @PUT("api/series/{tmdbId}/entry")
    suspend fun upsertEntry(
        @Path("tmdbId") tmdbId: Int,
        @Body body: UpsertSeriesEntryRequestDto,
    ): SeriesEntryDto
}
