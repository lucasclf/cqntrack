package xyz.cqn.cqntrack.profile.data

import retrofit2.http.GET
import retrofit2.http.Path

/** Espelha as rotas de favoritos públicos em apps/cqntrack_be/src/users/users.routes.ts. */
interface ProfileFavoritesApi {
    @GET("api/users/{username}/books/favorites")
    suspend fun getBookFavorites(@Path("username") username: String): BookFavoritesEnvelope

    @GET("api/users/{username}/movies/favorites")
    suspend fun getMovieFavorites(@Path("username") username: String): MovieFavoritesEnvelope

    @GET("api/users/{username}/games/favorites")
    suspend fun getGameFavorites(@Path("username") username: String): GameFavoritesEnvelope

    @GET("api/users/{username}/series/favorites")
    suspend fun getSeriesFavorites(@Path("username") username: String): SeriesFavoritesEnvelope

    @GET("api/users/{username}/manga/favorites")
    suspend fun getMangaFavorites(@Path("username") username: String): MangaFavoritesEnvelope
}
