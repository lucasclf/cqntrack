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
import xyz.cqn.cqntrack.books.ui.BookDetailScreen
import xyz.cqn.cqntrack.books.ui.BookSearchScreen
import xyz.cqn.cqntrack.games.ui.GameDetailScreen
import xyz.cqn.cqntrack.games.ui.GameDiscoverScreen
import xyz.cqn.cqntrack.games.ui.GameSearchScreen
import xyz.cqn.cqntrack.manga.ui.MangaDetailScreen
import xyz.cqn.cqntrack.manga.ui.MangaDiscoverScreen
import xyz.cqn.cqntrack.manga.ui.MangaSearchScreen
import xyz.cqn.cqntrack.movies.ui.MovieDetailScreen
import xyz.cqn.cqntrack.movies.ui.MovieDiscoverScreen
import xyz.cqn.cqntrack.movies.ui.MovieSearchScreen
import xyz.cqn.cqntrack.profile.data.FavoriteMediaType
import xyz.cqn.cqntrack.profile.ui.AccountScreen
import xyz.cqn.cqntrack.profile.ui.PublicProfileScreen
import xyz.cqn.cqntrack.series.ui.SeriesDetailScreen
import xyz.cqn.cqntrack.series.ui.SeriesDiscoverScreen
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

        composable(NavRoutes.ACCOUNT) {
            AccountScreen(onViewPublicProfile = { username ->
                navController.navigate(NavRoutes.publicProfile(username))
            })
        }
        composable(NavRoutes.PUBLIC_PROFILE) {
            PublicProfileScreen(onFavoriteClick = { favorite ->
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
            BookSearchScreen(onBookClick = { book ->
                navController.navigate(NavRoutes.bookDetail(book.googleBooksId))
            })
        }
        composable(NavRoutes.BOOK_DETAIL) {
            BookDetailScreen(onBack = { navController.popBackStack() })
        }

        composable(NavRoutes.MOVIE_DISCOVER) {
            MovieDiscoverScreen(
                onMovieClick = { movie -> navController.navigate(NavRoutes.movieDetail(movie.tmdbId)) },
                onSearchClick = { navController.navigate(NavRoutes.MOVIE_SEARCH) },
            )
        }
        composable(NavRoutes.MOVIE_SEARCH) {
            MovieSearchScreen(onMovieClick = { movie ->
                navController.navigate(NavRoutes.movieDetail(movie.tmdbId))
            })
        }
        composable(NavRoutes.MOVIE_DETAIL) {
            MovieDetailScreen(onBack = { navController.popBackStack() })
        }

        composable(NavRoutes.GAME_DISCOVER) {
            GameDiscoverScreen(
                onGameClick = { game -> navController.navigate(NavRoutes.gameDetail(game.igdbId)) },
                onSearchClick = { navController.navigate(NavRoutes.GAME_SEARCH) },
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

        composable(NavRoutes.SERIES_DISCOVER) {
            SeriesDiscoverScreen(
                onSeriesClick = { series -> navController.navigate(NavRoutes.seriesDetail(series.tmdbId)) },
                onSearchClick = { navController.navigate(NavRoutes.SERIES_SEARCH) },
            )
        }
        composable(NavRoutes.SERIES_SEARCH) {
            SeriesSearchScreen(onSeriesClick = { series ->
                navController.navigate(NavRoutes.seriesDetail(series.tmdbId))
            })
        }
        composable(NavRoutes.SERIES_DETAIL) {
            SeriesDetailScreen(onBack = { navController.popBackStack() })
        }

        composable(NavRoutes.MANGA_DISCOVER) {
            MangaDiscoverScreen(
                onMangaClick = { manga -> navController.navigate(NavRoutes.mangaDetail(manga.mangadexId)) },
                onSearchClick = { navController.navigate(NavRoutes.MANGA_SEARCH) },
            )
        }
        composable(NavRoutes.MANGA_SEARCH) {
            MangaSearchScreen(onMangaClick = { manga ->
                navController.navigate(NavRoutes.mangaDetail(manga.mangadexId))
            })
        }
        composable(NavRoutes.MANGA_DETAIL) {
            MangaDetailScreen(onBack = { navController.popBackStack() })
        }
    }
}

private fun NavHostController.navigateAndClearBackStack(route: String) {
    navigate(route) {
        popUpTo(0) { inclusive = true }
        launchSingleTop = true
    }
}
