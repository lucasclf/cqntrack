package xyz.cqn.cqntrack.series.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage

private fun formatRuntime(minutes: Int): String {
    val hours = minutes / 60
    val mins = minutes % 60
    if (hours == 0) return "${mins}min"
    return if (mins == 0) "${hours}h" else "${hours}h ${mins}min"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EpisodeDetailScreen(
    onBack: () -> Unit,
    onSeriesClick: () -> Unit,
    viewModel: EpisodeDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.episode?.name.orEmpty()) }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.episode == null -> Text(
                text = uiState.errorMessage ?: "Episódio não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> {
                val episode = uiState.episode!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                ) {
                    Text(
                        episode.seriesName,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        textDecoration = TextDecoration.Underline,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable(onClick = onSeriesClick),
                    )

                    AsyncImage(
                        model = episode.stillUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )

                    Text(
                        "Temporada ${episode.seasonNumber} · Episódio ${episode.episodeNumber}",
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    Text(episode.name, style = MaterialTheme.typography.titleLarge)

                    Row(modifier = Modifier.padding(top = 8.dp)) {
                        val parts = buildList {
                            episode.airDate?.let(::add)
                            episode.rating?.let { add("★ ${it}") }
                            episode.runtime?.let { add(formatRuntime(it)) }
                        }
                        Text(parts.joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
                    }

                    if (episode.overview != null) {
                        Text(
                            episode.overview,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 16.dp),
                        )
                    }

                    if (episode.directors.isNotEmpty()) {
                        Text(
                            "Direção",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(top = 16.dp),
                        )
                        Text(
                            episode.directors.joinToString(", ") { it.name },
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }

                    if (uiState.errorMessage != null) {
                        Text(
                            text = uiState.errorMessage.orEmpty(),
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 16.dp),
                        )
                    }

                    Button(
                        onClick = viewModel::toggleWatched,
                        modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    ) {
                        Text(if (episode.watched) "Desmarcar assistido" else "Marcar como assistido")
                    }

                    Button(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                        Text("Voltar")
                    }
                }
            }
        }
    }
}
