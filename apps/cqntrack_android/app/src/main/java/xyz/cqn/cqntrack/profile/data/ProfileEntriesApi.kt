package xyz.cqn.cqntrack.profile.data

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import xyz.cqn.cqntrack.books.data.PaginatedBookEntriesResponseDto
import xyz.cqn.cqntrack.games.data.PaginatedGameEntriesResponseDto
import xyz.cqn.cqntrack.manga.data.PaginatedMangaEntriesResponseDto
import xyz.cqn.cqntrack.movies.data.PaginatedMovieEntriesResponseDto
import xyz.cqn.cqntrack.series.data.PaginatedSeriesEntriesResponseDto

/**
 * Espelha as rotas de marcações públicas em apps/cqntrack_be/src/users/users.routes.ts — mesmo
 * schema de resposta das rotas autenticadas de "Minhas marcações" (o backend reaproveita
 * PaginatedXxxEntriesResponseSchema pros dois casos), só que sem sessão e com :username no path.
 * `sortBy`/`order`/`pageSize` ficam de fora aqui de propósito (defaults do backend bastam pra essa
 * versão mais simples de "ver marcações de outra pessoa").
 */
interface ProfileEntriesApi {
    @GET("api/users/{username}/books/entries")
    suspend fun getBookEntries(
        @Path("username") username: String,
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
    ): PaginatedBookEntriesResponseDto

    @GET("api/users/{username}/movies/entries")
    suspend fun getMovieEntries(
        @Path("username") username: String,
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
    ): PaginatedMovieEntriesResponseDto

    @GET("api/users/{username}/games/entries")
    suspend fun getGameEntries(
        @Path("username") username: String,
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
    ): PaginatedGameEntriesResponseDto

    /** Série não tem `status` — só progresso por episódio (mesma exceção de ListSeriesEntriesQuerySchema). */
    @GET("api/users/{username}/series/entries")
    suspend fun getSeriesEntries(
        @Path("username") username: String,
        @Query("page") page: Int = 1,
    ): PaginatedSeriesEntriesResponseDto

    @GET("api/users/{username}/manga/entries")
    suspend fun getMangaEntries(
        @Path("username") username: String,
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
    ): PaginatedMangaEntriesResponseDto
}
