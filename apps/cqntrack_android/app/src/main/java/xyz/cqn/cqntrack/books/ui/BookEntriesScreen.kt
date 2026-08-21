package xyz.cqn.cqntrack.books.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.books.data.BookEntryWithBookDto
import xyz.cqn.cqntrack.books.data.BookStatus

private val ENTRY_STATUS_LABELS = mapOf(
    BookStatus.WantToRead to "Quero ler",
    BookStatus.Reading to "Lendo",
    BookStatus.Read to "Lido",
    BookStatus.Dropped to "Abandonado",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookEntriesScreen(
    onBookClick: (String) -> Unit,
    viewModel: BookEntriesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Minhas marcações") }) },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            item {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .horizontalScroll(rememberScrollState()),
                ) {
                    FilterChip(
                        selected = uiState.statusFilter == null,
                        onClick = { viewModel.setStatusFilter(null) },
                        label = { Text("Todos") },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                    ENTRY_STATUS_LABELS.forEach { (status, label) ->
                        FilterChip(
                            selected = uiState.statusFilter == status,
                            onClick = { viewModel.setStatusFilter(status) },
                            label = { Text(label) },
                            modifier = Modifier.padding(end = 8.dp),
                        )
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .horizontalScroll(rememberScrollState()),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FilterChip(
                        selected = uiState.favoriteOnly,
                        onClick = { viewModel.setFavoriteOnly(!uiState.favoriteOnly) },
                        label = { Text("Favoritos") },
                        leadingIcon = {
                            Icon(
                                imageVector = if (uiState.favoriteOnly) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                                contentDescription = null,
                            )
                        },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                    BookEntrySortField.entries.forEach { field ->
                        FilterChip(
                            selected = uiState.sortBy == field,
                            onClick = { viewModel.setSortBy(field) },
                            label = { Text(field.label) },
                            modifier = Modifier.padding(end = 8.dp),
                        )
                    }
                    IconButton(onClick = viewModel::toggleOrder) {
                        Icon(Icons.Filled.SwapVert, contentDescription = "Inverter ordem")
                    }
                }
            }

            when {
                uiState.isLoading -> item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.Center,
                    ) { CircularProgressIndicator() }
                }

                uiState.errorMessage != null -> item {
                    Text(
                        text = uiState.errorMessage.orEmpty(),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(16.dp),
                    )
                }

                uiState.items.isEmpty() -> item {
                    Text(
                        "Nenhuma marcação encontrada com esses filtros.",
                        modifier = Modifier.padding(16.dp),
                    )
                }

                else -> {
                    items(uiState.items, key = { it.id }) { entry ->
                        BookEntryRow(entry = entry, onClick = { onBookClick(entry.book.googleBooksId) })
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            TextButton(onClick = viewModel::prevPage, enabled = uiState.page > 1) {
                                Text("Anterior")
                            }
                            Text(
                                "Página ${uiState.page} de ${uiState.totalPages}",
                                modifier = Modifier.padding(horizontal = 8.dp),
                            )
                            TextButton(onClick = viewModel::nextPage, enabled = uiState.page < uiState.totalPages) {
                                Text("Próxima")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BookEntryRow(entry: BookEntryWithBookDto, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(entry.book.title) },
        supportingContent = {
            val parts = buildList {
                entry.status?.let { ENTRY_STATUS_LABELS[it]?.let(::add) }
                entry.rating?.let { add("★ ${it}") }
            }
            if (parts.isNotEmpty()) Text(parts.joinToString(" · "))
        },
        leadingContent = {
            AsyncImage(
                model = entry.book.coverUrl,
                contentDescription = null,
                modifier = Modifier.size(48.dp, 64.dp),
            )
        },
        trailingContent = if (entry.favoritedAt != null) {
            { Icon(Icons.Filled.Favorite, contentDescription = "Favorito") }
        } else {
            null
        },
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    )
}
