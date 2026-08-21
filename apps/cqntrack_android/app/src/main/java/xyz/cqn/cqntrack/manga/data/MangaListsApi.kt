package xyz.cqn.cqntrack.manga.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** Espelha apps/cqntrack_be/src/manga/lists.routes.ts, montado em /api/manga-lists. */
interface MangaListsApi {
    @GET("api/manga-lists")
    suspend fun getLists(): MangaListsResponseDto

    @POST("api/manga-lists")
    suspend fun createList(@Body body: CreateMangaListRequestDto): MangaListDto

    @GET("api/manga-lists/{listId}")
    suspend fun getListDetail(@Path("listId") listId: String): MangaListDetailDto

    @PATCH("api/manga-lists/{listId}")
    suspend fun updateList(
        @Path("listId") listId: String,
        @Body body: UpdateMangaListRequestDto,
    ): MangaListDto

    @DELETE("api/manga-lists/{listId}")
    suspend fun deleteList(@Path("listId") listId: String)

    @PUT("api/manga-lists/{listId}/items/{mangadexId}")
    suspend fun addItem(@Path("listId") listId: String, @Path("mangadexId") mangadexId: String)

    @DELETE("api/manga-lists/{listId}/items/{mangadexId}")
    suspend fun removeItem(@Path("listId") listId: String, @Path("mangadexId") mangadexId: String)
}
