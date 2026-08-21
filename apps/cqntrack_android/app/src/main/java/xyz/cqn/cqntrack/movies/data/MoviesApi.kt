package xyz.cqn.cqntrack.movies.data

import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/movies/movies.routes.ts, montado em /api/movies. */
interface MoviesApi {
    @GET("api/movies/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchMoviesResponseDto

    @GET("api/movies/discover")
    suspend fun discover(@Query("page") page: Int = 1): DiscoverMoviesResponseDto

    @GET("api/movies/{tmdbId}")
    suspend fun getDetail(@Path("tmdbId") tmdbId: Int): MovieDetailResponseDto

    @PUT("api/movies/{tmdbId}/entry")
    suspend fun upsertEntry(
        @Path("tmdbId") tmdbId: Int,
        @Body body: UpsertMovieEntryRequestDto,
    ): MovieEntryDto

    /** Ver comentário equivalente em BooksApi.kt — corpo cru pra permitir limpar nota/review com null explícito. */
    @PUT("api/movies/{tmdbId}/entry")
    suspend fun upsertEntryRaw(@Path("tmdbId") tmdbId: Int, @Body body: JsonObject): MovieEntryDto

    @DELETE("api/movies/{tmdbId}/entry")
    suspend fun deleteEntry(@Path("tmdbId") tmdbId: Int)
}
