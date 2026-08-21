package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/series/series.routes.ts, montado em /api/series. */
interface SeriesApi {
    @GET("api/series/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchSeriesResponseDto

    @GET("api/series/discover")
    suspend fun discover(@Query("page") page: Int = 1): DiscoverSeriesResponseDto

    @GET("api/series/{tmdbId}")
    suspend fun getDetail(@Path("tmdbId") tmdbId: Int): SeriesDetailResponseDto

    @PUT("api/series/{tmdbId}/entry")
    suspend fun upsertEntry(
        @Path("tmdbId") tmdbId: Int,
        @Body body: UpsertSeriesEntryRequestDto,
    ): SeriesEntryDto

    /** Ver comentário equivalente em BooksApi.kt — corpo cru pra permitir limpar nota/review com null explícito. */
    @PUT("api/series/{tmdbId}/entry")
    suspend fun upsertEntryRaw(@Path("tmdbId") tmdbId: Int, @Body body: JsonObject): SeriesEntryDto

    @DELETE("api/series/{tmdbId}/entry")
    suspend fun deleteEntry(@Path("tmdbId") tmdbId: Int)

    @GET("api/series/{tmdbId}/seasons/{seasonNumber}")
    suspend fun getSeasonEpisodes(
        @Path("tmdbId") tmdbId: Int,
        @Path("seasonNumber") seasonNumber: Int,
    ): SeriesSeasonEpisodesResponseDto

    @PUT("api/series/{tmdbId}/episodes/{seasonNumber}/{episodeNumber}")
    suspend fun setEpisodeWatched(
        @Path("tmdbId") tmdbId: Int,
        @Path("seasonNumber") seasonNumber: Int,
        @Path("episodeNumber") episodeNumber: Int,
        @Body body: SetWatchedRequestDto,
    )

    @PUT("api/series/{tmdbId}/seasons/{seasonNumber}")
    suspend fun setSeasonWatched(
        @Path("tmdbId") tmdbId: Int,
        @Path("seasonNumber") seasonNumber: Int,
        @Body body: SetWatchedRequestDto,
    )
}
