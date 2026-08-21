package xyz.cqn.cqntrack.manga.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.manga.data.MangaStatus

private val STATUS_LABELS = mapOf(
    MangaStatus.WantToRead to "Quero ler",
    MangaStatus.Reading to "Lendo",
    MangaStatus.Read to "Lido",
    MangaStatus.Dropped to "Abandonado",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MangaDetailScreen(
    onBack: () -> Unit,
    viewModel: MangaDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.manga?.title.orEmpty()) }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.manga == null -> Text(
                text = uiState.errorMessage ?: "Mangá não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            ) {
                val manga = uiState.manga!!
                Row {
                    AsyncImage(
                        model = manga.coverUrl,
                        contentDescription = null,
                        modifier = Modifier.size(96.dp, 128.dp),
                    )
                    Column(modifier = Modifier.padding(start = 16.dp)) {
                        Text(manga.title, style = MaterialTheme.typography.titleLarge)
                        Text(
                            manga.authors.joinToString(", ") { it.name },
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        val read = uiState.entry?.readChapterCount ?: 0
                        Text("$read capítulos lidos", style = MaterialTheme.typography.bodySmall)
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

                Row(modifier = Modifier.padding(top = 16.dp)) {
                    STATUS_LABELS.forEach { (status, label) ->
                        FilterChip(
                            selected = uiState.entry?.status == status,
                            onClick = { viewModel.setStatus(status) },
                            label = { Text(label) },
                            modifier = Modifier.padding(end = 8.dp),
                        )
                    }
                }

                if (manga.description != null) {
                    Text(
                        text = manga.description,
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

                Button(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(top = 24.dp)) {
                    Text("Voltar")
                }
            }
        }
    }
}
