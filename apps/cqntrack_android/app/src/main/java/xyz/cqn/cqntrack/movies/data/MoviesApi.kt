package xyz.cqn.cqntrack.movies.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/movies/movies.routes.ts, montado em /api/movies. */
interface MoviesApi {
    @GET("api/movies/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchMoviesResponseDto

    @GET("api/movies/{tmdbId}")
    suspend fun getDetail(@Path("tmdbId") tmdbId: Int): MovieDetailResponseDto

    @PUT("api/movies/{tmdbId}/entry")
    suspend fun upsertEntry(
        @Path("tmdbId") tmdbId: Int,
        @Body body: UpsertMovieEntryRequestDto,
    ): MovieEntryDto
}
