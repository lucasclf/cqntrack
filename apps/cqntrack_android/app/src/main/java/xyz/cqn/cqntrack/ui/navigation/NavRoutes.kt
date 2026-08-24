package xyz.cqn.cqntrack.ui.navigation

object NavRoutes {
    const val LOGIN = "login"
    const val HOME = "home"

    const val BOOK_SEARCH = "book_search"
    const val BOOK_DETAIL = "book_detail/{googleBooksId}"
    fun bookDetail(googleBooksId: String) = "book_detail/$googleBooksId"
    const val BOOK_LISTS = "book_lists"
    const val BOOK_LIST_DETAIL = "book_list_detail/{listId}"
    fun bookListDetail(listId: String) = "book_list_detail/$listId"
    const val BOOK_ENTRIES = "book_entries"

    // Livro não tem Discover — Google Books não suporta popularidade real
    // (ver skill new-media-section) — Home leva direto pra busca.
    const val MOVIE_DISCOVER = "movie_discover"
    const val MOVIE_SEARCH = "movie_search"
    const val MOVIE_DETAIL = "movie_detail/{tmdbId}"
    fun movieDetail(tmdbId: Int) = "movie_detail/$tmdbId"
    const val MOVIE_LISTS = "movie_lists"
    const val MOVIE_LIST_DETAIL = "movie_list_detail/{listId}"
    fun movieListDetail(listId: String) = "movie_list_detail/$listId"
    const val MOVIE_ENTRIES = "movie_entries"

    const val GAME_DISCOVER = "game_discover"
    const val GAME_SEARCH = "game_search"
    const val GAME_DETAIL = "game_detail/{igdbId}"
    fun gameDetail(igdbId: Int) = "game_detail/$igdbId"
    const val GAME_LISTS = "game_lists"
    const val GAME_LIST_DETAIL = "game_list_detail/{listId}"
    fun gameListDetail(listId: String) = "game_list_detail/$listId"
    const val GAME_ENTRIES = "game_entries"

    const val SERIES_DISCOVER = "series_discover"
    const val SERIES_SEARCH = "series_search"
    const val SERIES_DETAIL = "series_detail/{tmdbId}"
    fun seriesDetail(tmdbId: Int) = "series_detail/$tmdbId"
    const val SERIES_LISTS = "series_lists"
    const val SERIES_LIST_DETAIL = "series_list_detail/{listId}"
    fun seriesListDetail(listId: String) = "series_list_detail/$listId"
    const val SERIES_ENTRIES = "series_entries"
    const val SERIES_EPISODE_DETAIL = "series_episode_detail/{tmdbId}/{seasonNumber}/{episodeNumber}"
    fun seriesEpisodeDetail(tmdbId: Int, seasonNumber: Int, episodeNumber: Int) =
        "series_episode_detail/$tmdbId/$seasonNumber/$episodeNumber"

    const val MANGA_DISCOVER = "manga_discover"
    const val MANGA_SEARCH = "manga_search"
    const val MANGA_DETAIL = "manga_detail/{mangadexId}"
    fun mangaDetail(mangadexId: String) = "manga_detail/$mangadexId"
    const val MANGA_LISTS = "manga_lists"
    const val MANGA_LIST_DETAIL = "manga_list_detail/{listId}"
    fun mangaListDetail(listId: String) = "manga_list_detail/$listId"
    const val MANGA_ENTRIES = "manga_entries"

    const val ACCOUNT = "account"
    const val PUBLIC_PROFILE = "public_profile/{username}"
    fun publicProfile(username: String) = "public_profile/$username"
}
