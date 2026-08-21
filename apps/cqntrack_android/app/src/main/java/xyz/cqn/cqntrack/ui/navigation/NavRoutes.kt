package xyz.cqn.cqntrack.ui.navigation

object NavRoutes {
    const val LOGIN = "login"
    const val HOME = "home"

    const val BOOK_SEARCH = "book_search"
    const val BOOK_DETAIL = "book_detail/{googleBooksId}"
    fun bookDetail(googleBooksId: String) = "book_detail/$googleBooksId"

    const val MOVIE_SEARCH = "movie_search"
    const val MOVIE_DETAIL = "movie_detail/{tmdbId}"
    fun movieDetail(tmdbId: Int) = "movie_detail/$tmdbId"

    const val GAME_SEARCH = "game_search"
    const val GAME_DETAIL = "game_detail/{igdbId}"
    fun gameDetail(igdbId: Int) = "game_detail/$igdbId"

    const val SERIES_SEARCH = "series_search"
    const val SERIES_DETAIL = "series_detail/{tmdbId}"
    fun seriesDetail(tmdbId: Int) = "series_detail/$tmdbId"

    const val MANGA_SEARCH = "manga_search"
    const val MANGA_DETAIL = "manga_detail/{mangadexId}"
    fun mangaDetail(mangadexId: String) = "manga_detail/$mangadexId"
}
