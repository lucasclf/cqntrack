package xyz.cqn.cqntrack.series.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.series.data.ContinueWatchingItemDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContinueWatchingScreen(
    onItemClick: (ContinueWatchingItemDto) -> Unit,
    viewModel: ContinueWatchingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Continuar assistindo") }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.errorMessage != null && uiState.items.isEmpty() -> Text(
                text = uiState.errorMessage.orEmpty(),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            uiState.items.isEmpty() -> Text(
                text = "Nenhum episódio pendente — tudo em dia!",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(uiState.items, key = { it.series.tmdbId }) { item ->
                    ListItem(
                        headlineContent = { Text(item.series.name) },
                        supportingContent = {
                            Text(
                                "Temporada ${item.nextEpisode.seasonNumber} · " +
                                    "Episódio ${item.nextEpisode.episodeNumber} — ${item.nextEpisode.name}\n" +
                                    "Lançado em ${formatFullDate(item.nextEpisode.airDate)}",
                            )
                        },
                        leadingContent = {
                            AsyncImage(
                                model = item.series.posterUrl,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp, 64.dp),
                            )
                        },
                        modifier = Modifier.fillMaxWidth().clickable { onItemClick(item) },
                    )
                }

                if (uiState.nextCursor != null) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            if (uiState.loadingMore) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                            } else {
                                TextButton(onClick = viewModel::loadMore) { Text("Carregar mais") }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" sem passar por Date — mesmo motivo de formatFullDate em ContinueWatching.tsx (evita bug de fuso). */
private fun formatFullDate(isoDate: String): String {
    val parts = isoDate.split("-")
    return if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else isoDate
}
