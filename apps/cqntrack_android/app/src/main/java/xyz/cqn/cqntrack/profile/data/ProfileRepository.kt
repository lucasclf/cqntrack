package xyz.cqn.cqntrack.profile.data

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val profileApi: ProfileApi,
    private val favoritesApi: ProfileFavoritesApi,
) {
    suspend fun getMe(): AuthUserDto = runApiCall { profileApi.getMe() }

    suspend fun getPublicProfile(username: String): PublicProfileDto =
        runApiCall { profileApi.getPublicProfile(username) }

    /**
     * Busca os favoritos das 5 seções em paralelo e devolve tudo já
     * normalizado numa lista só. Cada chamada falha isolada (`emptyList()`
     * em vez de propagar) — uma seção fora do ar não deve derrubar a tela
     * inteira, só aquele pedaço fica sem favoritos.
     */
    suspend fun getFavorites(username: String): List<FavoriteItem> = coroutineScope {
        val books = async { runCatching { favoritesApi.getBookFavorites(username).items }.getOrDefault(emptyList()) }
        val movies = async { runCatching { favoritesApi.getMovieFavorites(username).items }.getOrDefault(emptyList()) }
        val games = async { runCatching { favoritesApi.getGameFavorites(username).items }.getOrDefault(emptyList()) }
        val series = async { runCatching { favoritesApi.getSeriesFavorites(username).items }.getOrDefault(emptyList()) }
        val manga = async { runCatching { favoritesApi.getMangaFavorites(username).items }.getOrDefault(emptyList()) }

        books.await().map {
            FavoriteItem(it.book.googleBooksId, it.book.title, it.book.coverUrl, FavoriteMediaType.BOOK)
        } + movies.await().map {
            FavoriteItem(it.movie.tmdbId.toString(), it.movie.name, it.movie.posterUrl, FavoriteMediaType.MOVIE)
        } + games.await().map {
            FavoriteItem(it.game.igdbId.toString(), it.game.name, it.game.coverUrl, FavoriteMediaType.GAME)
        } + series.await().map {
            FavoriteItem(it.series.tmdbId.toString(), it.series.name, it.series.posterUrl, FavoriteMediaType.SERIES)
        } + manga.await().map {
            FavoriteItem(it.manga.mangadexId, it.manga.title, it.manga.coverUrl, FavoriteMediaType.MANGA)
        }
    }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
