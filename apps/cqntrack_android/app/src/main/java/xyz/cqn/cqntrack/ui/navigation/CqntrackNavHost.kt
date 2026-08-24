package xyz.cqn.cqntrack.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import xyz.cqn.cqntrack.books.ui.AuthorDetailScreen as BookAuthorDetailScreen
import xyz.cqn.cqntrack.books.ui.BookDetailScreen
import xyz.cqn.cqntrack.books.ui.BookEntriesScreen
import xyz.cqn.cqntrack.books.ui.BookListDetailScreen
import xyz.cqn.cqntrack.books.ui.BookListsScreen
import xyz.cqn.cqntrack.books.ui.BookSearchScreen
import xyz.cqn.cqntrack.games.ui.GameDetailScreen
import xyz.cqn.cqntrack.games.ui.GameDiscoverScreen
import xyz.cqn.cqntrack.games.ui.GameEntriesScreen
import xyz.cqn.cqntrack.games.ui.GameListDetailScreen
import xyz.cqn.cqntrack.games.ui.GameListsScreen
import xyz.cqn.cqntrack.games.ui.GameSearchScreen
import xyz.cqn.cqntrack.manga.ui.AuthorDetailScreen as MangaAuthorDetailScreen
import xyz.cqn.cqntrack.manga.ui.MangaDetailScreen
import xyz.cqn.cqntrack.manga.ui.MangaDiscoverScreen
import xyz.cqn.cqntrack.manga.ui.MangaEntriesScreen
import xyz.cqn.cqntrack.manga.ui.MangaListDetailScreen
import xyz.cqn.cqntrack.manga.ui.MangaListsScreen
import xyz.cqn.cqntrack.manga.ui.MangaSearchScreen
import xyz.cqn.cqntrack.movies.ui.MovieDetailScreen
import xyz.cqn.cqntrack.movies.ui.MovieDiscoverScreen
import xyz.cqn.cqntrack.movies.ui.MovieEntriesScreen
import xyz.cqn.cqntrack.movies.ui.MovieListDetailScreen
import xyz.cqn.cqntrack.movies.ui.MovieListsScreen
import xyz.cqn.cqntrack.movies.ui.MovieSearchScreen
import xyz.cqn.cqntrack.people.data.PersonCreditMediaType
import xyz.cqn.cqntrack.people.ui.PersonDetailScreen
import xyz.cqn.cqntrack.profile.data.FavoriteMediaType
import xyz.cqn.cqntrack.profile.ui.AccountScreen
import xyz.cqn.cqntrack.profile.ui.PublicProfileScreen
import xyz.cqn.cqntrack.series.ui.EpisodeDetailScreen
import xyz.cqn.cqntrack.series.ui.SeriesDetailScreen
import xyz.cqn.cqntrack.series.ui.SeriesDiscoverScreen
import xyz.cqn.cqntrack.series.ui.SeriesEntriesScreen
import xyz.cqn.cqntrack.series.ui.SeriesListDetailScreen
import xyz.cqn.cqntrack.series.ui.SeriesListsScreen
import xyz.cqn.cqntrack.series.ui.SeriesSearchScreen
import xyz.cqn.cqntrack.ui.auth.LoginScreen
import xyz.cqn.cqntrack.ui.home.HomeScreen

/**
 * Ponto de entrada da navegação — reage a RootViewModel.isLoggedIn (que só
 * espelha AuthRepository.isLoggedIn, ver core:auth/TokenStorage) em vez de
 * cada tela decidir "pra onde ir" depois de logar/deslogar. `startDestination`
 * já nasce correto (evita um flash da tela de login pra quem já tem token
 * salvo); o LaunchedEffect cobre a transição que acontece em runtime (login
 * bem-sucedido enquanto o app já está aberto).
 */
@Composable
fun CqntrackNavHost() {
    val navController = rememberNavController()
    val rootViewModel: RootViewModel = hiltViewModel()
    val isLoggedIn by rootViewModel.isLoggedIn.collectAsState()

    val startDestination = remember { if (isLoggedIn) NavRoutes.HOME else NavRoutes.LOGIN }

    LaunchedEffect(isLoggedIn) {
        val currentRoute = navController.currentBackStackEntry?.destination?.route
        if (isLoggedIn && currentRoute == NavRoutes.LOGIN) {
            navController.navigateAndClearBackStack(NavRoutes.HOME)
        } else if (!isLoggedIn && currentRoute != NavRoutes.LOGIN) {
            navController.navigateAndClearBackStack(NavRoutes.LOGIN)
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(NavRoutes.LOGIN) {
            LoginScreen()
        }

        composable(NavRoutes.HOME) {
            HomeScreen(
                onOpenBooks = { navController.navigate(NavRoutes.BOOK_SEARCH) },
                onOpenMovies = { navController.navigate(NavRoutes.MOVIE_DISCOVER) },
                onOpenGames = { navController.navigate(NavRoutes.GAME_DISCOVER) },
                onOpenSeries = { navController.navigate(NavRoutes.SERIES_DISCOVER) },
                onOpenManga = { navController.navigate(NavRoutes.MANGA_DISCOVER) },
                onOpenAccount = { navController.navigate(NavRoutes.ACCOUNT) },
            )
        }

        composable(NavRoutes.PERSON_DETAIL) {
            PersonDetailScreen(onCreditClick = { mediaType, id ->
                val route = when (mediaType) {
                    PersonCreditMediaType.Movies -> NavRoutes.movieDetail(id)
                    PersonCreditMediaType.Series -> NavRoutes.seriesDetail(id)
                }
                navController.navigate(route)
            })
        }

        composable(NavRoutes.ACCOUNT) {
            AccountScreen(onViewPublicProfile = { username ->
                navController.navigate(NavRoutes.publicProfile(username))
            })
        }
        composable(NavRoutes.PUBLIC_PROFILE) {
            PublicProfileScreen(onItemClick = { favorite ->
                val route = when (favorite.mediaType) {
                    FavoriteMediaType.BOOK -> NavRoutes.bookDetail(favorite.id)
                    FavoriteMediaType.MOVIE -> NavRoutes.movieDetail(favorite.id.toInt())
                    FavoriteMediaType.GAME -> NavRoutes.gameDetail(favorite.id.toInt())
                    FavoriteMediaType.SERIES -> NavRoutes.seriesDetail(favorite.id.toInt())
                    FavoriteMediaType.MANGA -> NavRoutes.mangaDetail(favorite.id)
                }
                navController.navigate(route)
            })
        }

        composable(NavRoutes.BOOK_SEARCH) {
            BookSearchScreen(
                onBookClick = { book -> navController.navigate(NavRoutes.bookDetail(book.googleBooksId)) },
                onListsClick = { navController.navigate(NavRoutes.BOOK_LISTS) },
                onEntriesClick = { navController.navigate(NavRoutes.BOOK_ENTRIES) },
            )
        }
        composable(NavRoutes.BOOK_ENTRIES) {
            BookEntriesScreen(
                onBookClick = { googleBooksId -> navController.navigate(NavRoutes.bookDetail(googleBooksId)) },
            )
        }
        composable(NavRoutes.BOOK_DETAIL) {
            BookDetailScreen(
                onBack = { navController.popBackStack() },
                onAuthorClick = { name -> navController.navigate(NavRoutes.bookAuthorDetail(name)) },
            )
        }
        composable(NavRoutes.BOOK_AUTHOR_DETAIL) {
            BookAuthorDetailScreen(
                onBookClick = { book -> navController.navigate(NavRoutes.bookDetail(book.googleBooksId)) },
            )
        }
        composable(NavRoutes.BOOK_LISTS) {
            BookListsScreen(
                onListClick = { list -> navController.navigate(NavRoutes.bookListDetail(list.id)) },
            )
        }
        composable(NavRoutes.BOOK_LIST_DETAIL) {
            BookListDetailScreen(
                onBack = { navController.popBackStack() },
                onBookClick = { book -> navController.navigate(NavRoutes.bookDetail(book.googleBooksId)) },
            )
        }

        composable(NavRoutes.MOVIE_DISCOVER) {
            MovieDiscoverScreen(
                onMovieClick = { movie -> navController.navigate(NavRoutes.movieDetail(movie.tmdbId)) },
                onSearchClick = { navController.navigate(NavRoutes.MOVIE_SEARCH) },
                onListsClick = { navController.navigate(NavRoutes.MOVIE_LISTS) },
                onEntriesClick = { navController.navigate(NavRoutes.MOVIE_ENTRIES) },
            )
        }
        composable(NavRoutes.MOVIE_ENTRIES) {
            MovieEntriesScreen(
                onMovieClick = { tmdbId -> navController.navigate(NavRoutes.movieDetail(tmdbId)) },
            )
        }
        composable(NavRoutes.MOVIE_SEARCH) {
            MovieSearchScreen(onMovieClick = { movie ->
                navController.navigate(NavRoutes.movieDetail(movie.tmdbId))
            })
        }
        composable(NavRoutes.MOVIE_DETAIL) {
            MovieDetailScreen(
                onBack = { navController.popBackStack() },
                onPersonClick = { personId -> navController.navigate(NavRoutes.personDetail(personId)) },
            )
        }
        composable(NavRoutes.MOVIE_LISTS) {
            MovieListsScreen(
                onListClick = { list -> navController.navigate(NavRoutes.movieListDetail(list.id)) },
            )
        }
        composable(NavRoutes.MOVIE_LIST_DETAIL) {
            MovieListDetailScreen(
                onBack = { navController.popBackStack() },
                onMovieClick = { movie -> navController.navigate(NavRoutes.movieDetail(movie.tmdbId)) },
            )
        }

        composable(NavRoutes.GAME_DISCOVER) {
            GameDiscoverScreen(
                onGameClick = { game -> navController.navigate(NavRoutes.gameDetail(game.igdbId)) },
                onSearchClick = { navController.navigate(NavRoutes.GAME_SEARCH) },
                onListsClick = { navController.navigate(NavRoutes.GAME_LISTS) },
                onEntriesClick = { navController.navigate(NavRoutes.GAME_ENTRIES) },
            )
        }
        composable(NavRoutes.GAME_ENTRIES) {
            GameEntriesScreen(
                onGameClick = { igdbId -> navController.navigate(NavRoutes.gameDetail(igdbId)) },
            )
        }
        composable(NavRoutes.GAME_SEARCH) {
            GameSearchScreen(onGameClick = { game ->
                navController.navigate(NavRoutes.gameDetail(game.igdbId))
            })
        }
        composable(NavRoutes.GAME_DETAIL) {
            GameDetailScreen(onBack = { navController.popBackStack() })
        }
        composable(NavRoutes.GAME_LISTS) {
            GameListsScreen(
                onListClick = { list -> navController.navigate(NavRoutes.gameListDetail(list.id)) },
            )
        }
        composable(NavRoutes.GAME_LIST_DETAIL) {
            GameListDetailScreen(
                onBack = { navController.popBackStack() },
                onGameClick = { game -> navController.navigate(NavRoutes.gameDetail(game.igdbId)) },
            )
        }

        composable(NavRoutes.SERIES_DISCOVER) {
            SeriesDiscoverScreen(
                onSeriesClick = { series -> navController.navigate(NavRoutes.seriesDetail(series.tmdbId)) },
                onSearchClick = { navController.navigate(NavRoutes.SERIES_SEARCH) },
                onListsClick = { navController.navigate(NavRoutes.SERIES_LISTS) },
                onEntriesClick = { navController.navigate(NavRoutes.SERIES_ENTRIES) },
            )
        }
        composable(NavRoutes.SERIES_ENTRIES) {
            SeriesEntriesScreen(
                onSeriesClick = { tmdbId -> navController.navigate(NavRoutes.seriesDetail(tmdbId)) },
            )
        }
        composable(NavRoutes.SERIES_SEARCH) {
            SeriesSearchScreen(onSeriesClick = { series ->
                navController.navigate(NavRoutes.seriesDetail(series.tmdbId))
            })
        }
        composable(NavRoutes.SERIES_DETAIL) {
            SeriesDetailScreen(
                onBack = { navController.popBackStack() },
                onEpisodeClick = { tmdbId, seasonNumber, episodeNumber ->
                    navController.navigate(NavRoutes.seriesEpisodeDetail(tmdbId, seasonNumber, episodeNumber))
                },
                onPersonClick = { personId -> navController.navigate(NavRoutes.personDetail(personId)) },
            )
        }
        composable(NavRoutes.SERIES_EPISODE_DETAIL) {
            EpisodeDetailScreen(onBack = { navController.popBackStack() })
        }
        composable(NavRoutes.SERIES_LISTS) {
            SeriesListsScreen(
                onListClick = { list -> navController.navigate(NavRoutes.seriesListDetail(list.id)) },
            )
        }
        composable(NavRoutes.SERIES_LIST_DETAIL) {
            SeriesListDetailScreen(
                onBack = { navController.popBackStack() },
                onSeriesClick = { series -> navController.navigate(NavRoutes.seriesDetail(series.tmdbId)) },
            )
        }

        composable(NavRoutes.MANGA_DISCOVER) {
            MangaDiscoverScreen(
                onMangaClick = { manga -> navController.navigate(NavRoutes.mangaDetail(manga.mangadexId)) },
                onSearchClick = { navController.navigate(NavRoutes.MANGA_SEARCH) },
                onListsClick = { navController.navigate(NavRoutes.MANGA_LISTS) },
                onEntriesClick = { navController.navigate(NavRoutes.MANGA_ENTRIES) },
            )
        }
        composable(NavRoutes.MANGA_ENTRIES) {
            MangaEntriesScreen(
                onMangaClick = { mangadexId -> navController.navigate(NavRoutes.mangaDetail(mangadexId)) },
            )
        }
        composable(NavRoutes.MANGA_SEARCH) {
            MangaSearchScreen(onMangaClick = { manga ->
                navController.navigate(NavRoutes.mangaDetail(manga.mangadexId))
            })
        }
        composable(NavRoutes.MANGA_DETAIL) {
            MangaDetailScreen(
                onBack = { navController.popBackStack() },
                onAuthorClick = { authorId -> navController.navigate(NavRoutes.mangaAuthorDetail(authorId)) },
            )
        }
        composable(NavRoutes.MANGA_AUTHOR_DETAIL) {
            MangaAuthorDetailScreen(
                onMangaClick = { manga -> navController.navigate(NavRoutes.mangaDetail(manga.mangadexId)) },
            )
        }
        composable(NavRoutes.MANGA_LISTS) {
            MangaListsScreen(
                onListClick = { list -> navController.navigate(NavRoutes.mangaListDetail(list.id)) },
            )
        }
        composable(NavRoutes.MANGA_LIST_DETAIL) {
            MangaListDetailScreen(
                onBack = { navController.popBackStack() },
                onMangaClick = { manga -> navController.navigate(NavRoutes.mangaDetail(manga.mangadexId)) },
            )
        }
    }
}

private fun NavHostController.navigateAndClearBackStack(route: String) {
    navigate(route) {
        popUpTo(0) { inclusive = true }
        launchSingleTop = true
    }
}
