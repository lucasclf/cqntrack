package xyz.cqn.cqntrack.profile.data

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import retrofit2.HttpException
import xyz.cqn.cqntrack.books.data.BookStatus
import xyz.cqn.cqntrack.books.data.PaginatedBookEntriesResponseDto
import xyz.cqn.cqntrack.core.network.ApiException
import xyz.cqn.cqntrack.games.data.GameStatus
import xyz.cqn.cqntrack.games.data.PaginatedGameEntriesResponseDto
import xyz.cqn.cqntrack.manga.data.MangaStatus
import xyz.cqn.cqntrack.manga.data.PaginatedMangaEntriesResponseDto
import xyz.cqn.cqntrack.movies.data.MovieStatus
import xyz.cqn.cqntrack.movies.data.PaginatedMovieEntriesResponseDto
import xyz.cqn.cqntrack.series.data.PaginatedSeriesEntriesResponseDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val profileApi: ProfileApi,
    private val favoritesApi: ProfileFavoritesApi,
    private val entriesApi: ProfileEntriesApi,
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

    /** "Marcações" públicas por seção — mesma listagem de "Minhas marcações", só que de outro usuário e sem edição. */
    suspend fun getBookEntries(username: String, status: BookStatus?, page: Int): PaginatedBookEntriesResponseDto =
        runApiCall { entriesApi.getBookEntries(username, status?.toApiValue(), page) }

    suspend fun getMovieEntries(username: String, status: MovieStatus?, page: Int): PaginatedMovieEntriesResponseDto =
        runApiCall { entriesApi.getMovieEntries(username, status?.toApiValue(), page) }

    suspend fun getGameEntries(username: String, status: GameStatus?, page: Int): PaginatedGameEntriesResponseDto =
        runApiCall { entriesApi.getGameEntries(username, status?.toApiValue(), page) }

    suspend fun getSeriesEntries(username: String, page: Int): PaginatedSeriesEntriesResponseDto =
        runApiCall { entriesApi.getSeriesEntries(username, page) }

    suspend fun getMangaEntries(username: String, status: MangaStatus?, page: Int): PaginatedMangaEntriesResponseDto =
        runApiCall { entriesApi.getMangaEntries(username, status?.toApiValue(), page) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}

/** Mesmos valores de query dos repositórios de cada seção — ver comentário equivalente em BooksRepository.kt/etc. */
private fun BookStatus.toApiValue(): String = when (this) {
    BookStatus.WantToRead -> "want_to_read"
    BookStatus.Reading -> "reading"
    BookStatus.Read -> "read"
    BookStatus.Dropped -> "dropped"
}

private fun MovieStatus.toApiValue(): String = when (this) {
    MovieStatus.WantToWatch -> "want_to_watch"
    MovieStatus.Watched -> "watched"
}

private fun GameStatus.toApiValue(): String = when (this) {
    GameStatus.NotStarted -> "not_started"
    GameStatus.Playing -> "playing"
    GameStatus.Dropped -> "dropped"
    GameStatus.Completed -> "completed"
    GameStatus.Platinum -> "platinum"
}

private fun MangaStatus.toApiValue(): String = when (this) {
    MangaStatus.WantToRead -> "want_to_read"
    MangaStatus.Reading -> "reading"
    MangaStatus.Read -> "read"
    MangaStatus.Dropped -> "dropped"
}
