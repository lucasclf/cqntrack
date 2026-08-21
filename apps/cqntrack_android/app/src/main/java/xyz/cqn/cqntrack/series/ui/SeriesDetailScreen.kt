package xyz.cqn.cqntrack.series.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.series.data.SeriesEpisodeDto
import xyz.cqn.cqntrack.series.data.SeriesListDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeriesDetailScreen(
    onBack: () -> Unit,
    viewModel: SeriesDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.series?.name.orEmpty()) },
                actions = {
                    IconButton(onClick = viewModel::openAddToListDialog) {
                        Icon(Icons.Filled.PlaylistAdd, contentDescription = "Adicionar à lista")
                    }
                },
            )
        },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.series == null -> Text(
                text = uiState.errorMessage ?: "Série não encontrada.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            // Uma LazyColumn só pra tela inteira (cabeçalho + episódios) — uma
            // sinopse longa da TMDB pode estourar a altura de uma Column comum
            // sem scroll próprio, empurrando "Marcar temporada inteira"/episódios/
            // Voltar pra fora da tela sem jeito de rolar até lá (mesmo bug real
            // encontrado testando MangaDetailScreen contra a API de verdade —
            // corrigido aqui do mesmo jeito antes de acontecer de novo).
            else -> {
                val series = uiState.series!!
                LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                    item {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row {
                                AsyncImage(
                                    model = series.posterUrl,
                                    contentDescription = null,
                                    modifier = Modifier.size(96.dp, 128.dp),
                                )
                                Column(modifier = Modifier.padding(start = 16.dp)) {
                                    Text(series.name, style = MaterialTheme.typography.titleLarge)
                                    Text(
                                        series.genres.joinToString(", "),
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                    val total = series.numberOfEpisodes
                                    val watched = uiState.entry?.watchedEpisodeCount ?: 0
                                    if (total != null) {
                                        Text(
                                            "$watched/$total episódios assistidos",
                                            style = MaterialTheme.typography.bodySmall,
                                        )
                                    }
                                    IconButton(onClick = viewModel::toggleFavorite) {
                                        Icon(
                                            imageVector = if (uiState.entry?.favoritedAt != null) {
                                                Icons.Filled.Favorite
                                            } else {
                                                Icons.Filled.FavoriteBorder
                                            },
                                            contentDescription = "Favoritar",
                                        )
                                    }
                                }
                            }

                            // Série não tem status como filme/jogo/livro/mangá — só um toggle
                            // de "abandonada" (ver SeriesEntrySchema, sem campo `status`).
                            FilterChip(
                                selected = uiState.entry?.abandonedAt != null,
                                onClick = viewModel::toggleAbandoned,
                                label = { Text("Abandonada") },
                                modifier = Modifier.padding(top = 16.dp),
                            )

                            if (series.overview != null) {
                                Text(
                                    text = series.overview,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 16.dp),
                                )
                            }

                            if (uiState.errorMessage != null) {
                                Text(
                                    text = uiState.errorMessage.orEmpty(),
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(top = 16.dp),
                                )
                            }
                        }
                    }

                    if (!series.seasons.isNullOrEmpty()) {
                        item {
                            Text(
                                "Episódios",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                            Row(
                                modifier = Modifier
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                                    .horizontalScroll(rememberScrollState()),
                            ) {
                                series.seasons.forEach { season ->
                                    FilterChip(
                                        selected = uiState.selectedSeason == season.seasonNumber,
                                        onClick = { viewModel.selectSeason(season.seasonNumber) },
                                        label = { Text(season.name) },
                                        modifier = Modifier.padding(end = 8.dp),
                                    )
                                }
                            }

                            Button(
                                onClick = viewModel::toggleSeason,
                                enabled = !uiState.seasonActionPending && uiState.episodes.isNotEmpty(),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                            ) {
                                Text(
                                    if (uiState.episodes.isNotEmpty() && uiState.episodes.all { it.watched }) {
                                        "Desmarcar temporada inteira"
                                    } else {
                                        "Marcar temporada inteira"
                                    },
                                )
                            }
                        }

                        if (uiState.episodesLoading) {
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    horizontalArrangement = Arrangement.Center,
                                ) { CircularProgressIndicator(modifier = Modifier.size(24.dp)) }
                            }
                        } else {
                            items(uiState.episodes, key = { it.episodeNumber }) { episode ->
                                EpisodeRow(
                                    episode = episode,
                                    onToggle = { watched -> viewModel.toggleEpisode(episode.episodeNumber, watched) },
                                )
                            }
                        }
                    }

                    item {
                        Button(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Voltar")
                        }
                    }
                }
            }
        }
    }

    if (uiState.showAddToListDialog) {
        SeriesAddToListDialog(
            lists = uiState.availableLists,
            errorMessage = uiState.addToListMessage,
            onDismiss = viewModel::closeAddToListDialog,
            onListSelected = viewModel::addToList,
            onCreateAndAdd = viewModel::createListAndAdd,
        )
    }
}

@Composable
private fun SeriesAddToListDialog(
    lists: List<SeriesListDto>,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onListSelected: (String) -> Unit,
    onCreateAndAdd: (String) -> Unit,
) {
    var newListName by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adicionar à lista") },
        text = {
            Column {
                if (errorMessage != null) {
                    Text(text = errorMessage, color = MaterialTheme.colorScheme.error)
                }
                LazyColumn(modifier = Modifier.fillMaxWidth()) {
                    items(lists, key = { it.id }) { list ->
                        ListItem(
                            headlineContent = { Text(list.name) },
                            modifier = Modifier.fillMaxWidth().clickable { onListSelected(list.id) },
                        )
                    }
                }
                OutlinedTextField(
                    value = newListName,
                    onValueChange = { newListName = it },
                    label = { Text("Ou crie uma lista nova") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = newListName.isNotBlank(),
                onClick = { onCreateAndAdd(newListName.trim()) },
            ) { Text("Criar e adicionar") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Fechar") }
        },
    )
}

@Composable
private fun EpisodeRow(episode: SeriesEpisodeDto, onToggle: (Boolean) -> Unit) {
    ListItem(
        headlineContent = { Text("${episode.episodeNumber}. ${episode.name}") },
        supportingContent = episode.airDate?.let { { Text(it) } },
        leadingContent = {
            AsyncImage(
                model = episode.stillUrl,
                contentDescription = null,
                modifier = Modifier.size(64.dp, 40.dp),
            )
        },
        trailingContent = {
            Checkbox(checked = episode.watched, onCheckedChange = onToggle)
        },
    )
}
