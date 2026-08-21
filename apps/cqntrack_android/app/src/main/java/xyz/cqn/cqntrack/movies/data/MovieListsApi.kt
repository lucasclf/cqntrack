package xyz.cqn.cqntrack.movies.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** Espelha apps/cqntrack_be/src/movies/lists.routes.ts, montado em /api/movies-lists. */
interface MovieListsApi {
    @GET("api/movies-lists")
    suspend fun getLists(): MovieListsResponseDto

    @POST("api/movies-lists")
    suspend fun createList(@Body body: CreateMovieListRequestDto): MovieListDto

    @GET("api/movies-lists/{listId}")
    suspend fun getListDetail(@Path("listId") listId: String): MovieListDetailDto

    @PATCH("api/movies-lists/{listId}")
    suspend fun updateList(
        @Path("listId") listId: String,
        @Body body: UpdateMovieListRequestDto,
    ): MovieListDto

    @DELETE("api/movies-lists/{listId}")
    suspend fun deleteList(@Path("listId") listId: String)

    @PUT("api/movies-lists/{listId}/items/{tmdbId}")
    suspend fun addItem(@Path("listId") listId: String, @Path("tmdbId") tmdbId: Int)

    @DELETE("api/movies-lists/{listId}/items/{tmdbId}")
    suspend fun removeItem(@Path("listId") listId: String, @Path("tmdbId") tmdbId: Int)
}
