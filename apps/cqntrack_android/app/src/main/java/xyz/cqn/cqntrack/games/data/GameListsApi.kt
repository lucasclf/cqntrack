package xyz.cqn.cqntrack.games.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Espelha apps/cqntrack_be/src/games/lists.routes.ts — diferente das outras 4
 * seções, o router de listas de jogos é montado em /api/lists (não
 * /api/games-lists), resquício histórico de jogos ter sido a 1ª seção
 * implementada antes do padrão "/api/<seção>-lists" existir. Ver app.ts.
 */
interface GameListsApi {
    @GET("api/lists")
    suspend fun getLists(): GameListsResponseDto

    @POST("api/lists")
    suspend fun createList(@Body body: CreateGameListRequestDto): GameListDto

    @GET("api/lists/{listId}")
    suspend fun getListDetail(@Path("listId") listId: String): GameListDetailDto

    @PATCH("api/lists/{listId}")
    suspend fun updateList(
        @Path("listId") listId: String,
        @Body body: UpdateGameListRequestDto,
    ): GameListDto

    @DELETE("api/lists/{listId}")
    suspend fun deleteList(@Path("listId") listId: String)

    @PUT("api/lists/{listId}/items/{igdbId}")
    suspend fun addItem(@Path("listId") listId: String, @Path("igdbId") igdbId: Int)

    @DELETE("api/lists/{listId}/items/{igdbId}")
    suspend fun removeItem(@Path("listId") listId: String, @Path("igdbId") igdbId: Int)
}
