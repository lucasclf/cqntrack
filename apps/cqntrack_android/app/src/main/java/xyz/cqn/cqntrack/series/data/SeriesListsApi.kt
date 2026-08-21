package xyz.cqn.cqntrack.series.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** Espelha apps/cqntrack_be/src/series/lists.routes.ts, montado em /api/series-lists. */
interface SeriesListsApi {
    @GET("api/series-lists")
    suspend fun getLists(): SeriesListsResponseDto

    @POST("api/series-lists")
    suspend fun createList(@Body body: CreateSeriesListRequestDto): SeriesListDto

    @GET("api/series-lists/{listId}")
    suspend fun getListDetail(@Path("listId") listId: String): SeriesListDetailDto

    @PATCH("api/series-lists/{listId}")
    suspend fun updateList(
        @Path("listId") listId: String,
        @Body body: UpdateSeriesListRequestDto,
    ): SeriesListDto

    @DELETE("api/series-lists/{listId}")
    suspend fun deleteList(@Path("listId") listId: String)

    @PUT("api/series-lists/{listId}/items/{tmdbId}")
    suspend fun addItem(@Path("listId") listId: String, @Path("tmdbId") tmdbId: Int)

    @DELETE("api/series-lists/{listId}/items/{tmdbId}")
    suspend fun removeItem(@Path("listId") listId: String, @Path("tmdbId") tmdbId: Int)
}
