package xyz.cqn.cqntrack.profile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.books.data.BookStatus
import xyz.cqn.cqntrack.games.data.GameStatus
import xyz.cqn.cqntrack.manga.data.MangaStatus
import xyz.cqn.cqntrack.movies.data.MovieStatus
import xyz.cqn.cqntrack.profile.data.FavoriteItem
import xyz.cqn.cqntrack.profile.data.FavoriteMediaType
import xyz.cqn.cqntrack.social.ui.FollowButton

private val BOOK_STATUS_LABELS = mapOf(
    BookStatus.WantToRead to "Quero ler",
    BookStatus.Reading to "Lendo",
    BookStatus.Read to "Lido",
    BookStatus.Dropped to "Abandonado",
)
private val MOVIE_STATUS_LABELS = mapOf(
    MovieStatus.WantToWatch to "Quero ver",
    MovieStatus.Watched to "Já vi",
)
private val GAME_STATUS_LABELS = mapOf(
    GameStatus.NotStarted to "Quero jogar",
    GameStatus.Playing to "Jogando",
    GameStatus.Dropped to "Abandonado",
    GameStatus.Completed to "Finalizado",
    GameStatus.Platinum to "Platinado",
)
private val MANGA_STATUS_LABELS = mapOf(
    MangaStatus.WantToRead to "Quero ler",
    MangaStatus.Reading to "Lendo",
    MangaStatus.Read to "Lido",
    MangaStatus.Dropped to "Abandonado",
)
private val TAB_ORDER = listOf(
    FavoriteMediaType.MOVIE,
    FavoriteMediaType.SERIES,
    FavoriteMediaType.GAME,
    FavoriteMediaType.BOOK,
    FavoriteMediaType.MANGA,
)
private val TAB_LABELS = mapOf(
    FavoriteMediaType.MOVIE to "Filmes",
    FavoriteMediaType.SERIES to "Séries",
    FavoriteMediaType.GAME to "Jogos",
    FavoriteMediaType.BOOK to "Livros",
    FavoriteMediaType.MANGA to "Mangás",
)

/** Uma marcação já normalizada pra renderização — cada aba monta a lista dela a partir do DTO paginado certo. */
private data class EntryRow(val title: String, val imageUrl: String?, val subtitle: String?, val item: FavoriteItem)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicProfileScreen(
    onItemClick: (FavoriteItem) -> Unit,
    viewModel: PublicProfileViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.profile?.displayUsername ?: "Perfil") }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.profile == null -> Text(
                text = uiState.errorMessage ?: "Perfil não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> {
                val profile = uiState.profile!!
                LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                    item {
                        Column(modifier = Modifier.padding(16.dp)) {
                            AsyncImage(
                                model = profile.image,
                                contentDescription = null,
                                modifier = Modifier.size(96.dp).clip(CircleShape),
                            )
                            Text(
                                "@${profile.displayUsername}",
                                style = MaterialTheme.typography.titleLarge,
                                modifier = Modifier.padding(top = 12.dp),
                            )
                            // memberSince vem como ISO 8601 (z.iso.datetime()) — só a
                            // data interessa aqui, sem precisar de uma lib só pra isso.
                            Text(
                                "Membro desde ${profile.memberSince.take(10)}",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                            FollowButton(
                                username = profile.username,
                                viewerUsername = uiState.viewerUsername,
                            )
                        }
                    }

                    item {
                        Text(
                            "Favoritos",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(horizontal = 16.dp),
                        )
                    }
                    when {
                        uiState.favoritesLoading -> item {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.Center,
                            ) { CircularProgressIndicator(modifier = Modifier.size(24.dp)) }
                        }

                        uiState.favorites.isEmpty() -> item {
                            Text(
                                "Nenhum favorito ainda.",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(16.dp),
                            )
                        }

                        else -> item {
                            Row(
                                modifier = Modifier
                                    .horizontalScroll(rememberScrollState())
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                            ) {
                                uiState.favorites.forEach { favorite ->
                                    Column(
                                        modifier = Modifier
                                            .width(88.dp)
                                            .padding(end = 12.dp)
                                            .clickable { onItemClick(favorite) },
                                    ) {
                                        AsyncImage(
                                            model = favorite.imageUrl,
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxWidth().size(120.dp),
                                        )
                                        Text(
                                            favorite.title,
                                            style = MaterialTheme.typography.bodySmall,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.padding(top = 4.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                        ) {
                            TAB_ORDER.forEach { tab ->
                                FilterChip(
                                    selected = uiState.selectedTab == tab,
                                    onClick = { viewModel.selectTab(tab) },
                                    label = { Text(TAB_LABELS.getValue(tab)) },
                                    modifier = Modifier.padding(end = 8.dp),
                                )
                            }
                        }
                    }

                    when (uiState.selectedTab) {
                        FavoriteMediaType.BOOK -> item {
                            StatusFilterRow(BOOK_STATUS_LABELS, uiState.bookStatusFilter, viewModel::setBookStatusFilter)
                        }
                        FavoriteMediaType.MOVIE -> item {
                            StatusFilterRow(MOVIE_STATUS_LABELS, uiState.movieStatusFilter, viewModel::setMovieStatusFilter)
                        }
                        FavoriteMediaType.GAME -> item {
                            StatusFilterRow(GAME_STATUS_LABELS, uiState.gameStatusFilter, viewModel::setGameStatusFilter)
                        }
                        FavoriteMediaType.MANGA -> item {
                            StatusFilterRow(MANGA_STATUS_LABELS, uiState.mangaStatusFilter, viewModel::setMangaStatusFilter)
                        }
                        // Série não tem status — só progresso por episódio, sem filtro aqui.
                        FavoriteMediaType.SERIES -> {}
                    }

                    val (rows, page, pageSize, total) = entriesFor(uiState)

                    when {
                        uiState.entriesLoading -> item {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.Center,
                            ) { CircularProgressIndicator() }
                        }

                        uiState.entriesErrorMessage != null -> item {
                            Text(
                                text = uiState.entriesErrorMessage.orEmpty(),
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(16.dp),
                            )
                        }

                        rows.isEmpty() -> item {
                            Text("Nenhuma marcação encontrada.", modifier = Modifier.padding(16.dp))
                        }

                        else -> {
                            rows.forEach { row ->
                                item(key = "${row.item.mediaType}_${row.item.id}") {
                                    ListItem(
                                        headlineContent = { Text(row.title) },
                                        supportingContent = row.subtitle?.let { { Text(it) } },
                                        leadingContent = {
                                            AsyncImage(
                                                model = row.imageUrl,
                                                contentDescription = null,
                                                modifier = Modifier.size(48.dp, 64.dp),
                                            )
                                        },
                                        modifier = Modifier.fillMaxWidth().clickable { onItemClick(row.item) },
                                    )
                                }
                            }

                            val totalPages = if (total == 0) 1 else ((total - 1) / pageSize) + 1
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    TextButton(onClick = viewModel::prevPage, enabled = page > 1) { Text("Anterior") }
                                    Text("Página $page de $totalPages", modifier = Modifier.padding(horizontal = 8.dp))
                                    TextButton(onClick = viewModel::nextPage, enabled = page < totalPages) { Text("Próxima") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun <T> StatusFilterRow(labels: Map<T, String>, selected: T?, onSelect: (T?) -> Unit) {
    Row(
        modifier = Modifier
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        FilterChip(
            selected = selected == null,
            onClick = { onSelect(null) },
            label = { Text("Todos") },
            modifier = Modifier.padding(end = 8.dp),
        )
        labels.forEach { (status, label) ->
            FilterChip(
                selected = selected == status,
                onClick = { onSelect(status) },
                label = { Text(label) },
                modifier = Modifier.padding(end = 8.dp),
            )
        }
    }
}

private data class EntriesPage(val rows: List<EntryRow>, val page: Int, val pageSize: Int, val total: Int)

/** Normaliza o DTO paginado da aba selecionada pra um formato único de renderização. */
private fun entriesFor(uiState: PublicProfileUiState): EntriesPage = when (uiState.selectedTab) {
    FavoriteMediaType.BOOK -> {
        val response = uiState.bookEntries
        EntriesPage(
            rows = response?.items.orEmpty().map { entry ->
                val subtitle = buildList {
                    entry.status?.let { BOOK_STATUS_LABELS[it]?.let(::add) }
                    entry.rating?.let { add("★ $it") }
                }.joinToString(" · ").ifBlank { null }
                EntryRow(
                    title = entry.book.title,
                    imageUrl = entry.book.coverUrl,
                    subtitle = subtitle,
                    item = FavoriteItem(entry.book.googleBooksId, entry.book.title, entry.book.coverUrl, FavoriteMediaType.BOOK),
                )
            },
            page = response?.page ?: 1,
            pageSize = response?.pageSize ?: 24,
            total = response?.total ?: 0,
        )
    }

    FavoriteMediaType.MOVIE -> {
        val response = uiState.movieEntries
        EntriesPage(
            rows = response?.items.orEmpty().map { entry ->
                val subtitle = buildList {
                    entry.status?.let { MOVIE_STATUS_LABELS[it]?.let(::add) }
                    entry.rating?.let { add("★ $it") }
                }.joinToString(" · ").ifBlank { null }
                EntryRow(
                    title = entry.movie.name,
                    imageUrl = entry.movie.posterUrl,
                    subtitle = subtitle,
                    item = FavoriteItem(
                        entry.movie.tmdbId.toString(),
                        entry.movie.name,
                        entry.movie.posterUrl,
                        FavoriteMediaType.MOVIE,
                    ),
                )
            },
            page = response?.page ?: 1,
            pageSize = response?.pageSize ?: 24,
            total = response?.total ?: 0,
        )
    }

    FavoriteMediaType.GAME -> {
        val response = uiState.gameEntries
        EntriesPage(
            rows = response?.items.orEmpty().map { entry ->
                val subtitle = buildList {
                    entry.status?.let { GAME_STATUS_LABELS[it]?.let(::add) }
                    entry.rating?.let { add("★ $it") }
                }.joinToString(" · ").ifBlank { null }
                EntryRow(
                    title = entry.game.name,
                    imageUrl = entry.game.coverUrl,
                    subtitle = subtitle,
                    item = FavoriteItem(
                        entry.game.igdbId.toString(),
                        entry.game.name,
                        entry.game.coverUrl,
                        FavoriteMediaType.GAME,
                    ),
                )
            },
            page = response?.page ?: 1,
            pageSize = response?.pageSize ?: 24,
            total = response?.total ?: 0,
        )
    }

    FavoriteMediaType.SERIES -> {
        val response = uiState.seriesEntries
        EntriesPage(
            rows = response?.items.orEmpty().map { entry ->
                val subtitle = buildList {
                    add("${entry.watchedEpisodeCount} episódios assistidos")
                    entry.rating?.let { add("★ $it") }
                }.joinToString(" · ")
                EntryRow(
                    title = entry.series.name,
                    imageUrl = entry.series.posterUrl,
                    subtitle = subtitle,
                    item = FavoriteItem(
                        entry.series.tmdbId.toString(),
                        entry.series.name,
                        entry.series.posterUrl,
                        FavoriteMediaType.SERIES,
                    ),
                )
            },
            page = response?.page ?: 1,
            pageSize = response?.pageSize ?: 24,
            total = response?.total ?: 0,
        )
    }

    FavoriteMediaType.MANGA -> {
        val response = uiState.mangaEntries
        EntriesPage(
            rows = response?.items.orEmpty().map { entry ->
                val subtitle = buildList {
                    entry.status?.let { MANGA_STATUS_LABELS[it]?.let(::add) }
                    entry.rating?.let { add("★ $it") }
                }.joinToString(" · ").ifBlank { null }
                EntryRow(
                    title = entry.manga.title,
                    imageUrl = entry.manga.coverUrl,
                    subtitle = subtitle,
                    item = FavoriteItem(entry.manga.mangadexId, entry.manga.title, entry.manga.coverUrl, FavoriteMediaType.MANGA),
                )
            },
            page = response?.page ?: 1,
            pageSize = response?.pageSize ?: 24,
            total = response?.total ?: 0,
        )
    }
}
