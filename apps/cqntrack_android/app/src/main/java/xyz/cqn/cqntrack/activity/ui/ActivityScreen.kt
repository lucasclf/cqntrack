package xyz.cqn.cqntrack.activity.ui

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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.activity.data.ActivityItemDto
import xyz.cqn.cqntrack.activity.data.MediaType
import xyz.cqn.cqntrack.activity.describeActivity
import xyz.cqn.cqntrack.activity.formatActivityDate

private val MEDIA_TYPE_LABELS = mapOf(
    MediaType.Games to "Jogos",
    MediaType.Series to "Séries",
    MediaType.Movies to "Filmes",
    MediaType.Books to "Livros",
    MediaType.Manga to "Mangás",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityScreen(
    onItemClick: (ActivityItemDto) -> Unit,
    viewModel: ActivityViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Atividades") }) },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            item {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .horizontalScroll(rememberScrollState()),
                ) {
                    FilterChip(
                        selected = uiState.mediaTypeFilter == null,
                        onClick = { viewModel.setMediaTypeFilter(null) },
                        label = { Text("Todas") },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                    MEDIA_TYPE_LABELS.forEach { (mediaType, label) ->
                        FilterChip(
                            selected = uiState.mediaTypeFilter == mediaType,
                            onClick = { viewModel.setMediaTypeFilter(mediaType) },
                            label = { Text(label) },
                            modifier = Modifier.padding(end = 8.dp),
                        )
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
                    Text("Nenhuma atividade por aqui ainda.", modifier = Modifier.padding(16.dp))
                }

                else -> {
                    items(uiState.items, key = { it.id }) { activityItem ->
                        ActivityRow(item = activityItem, onClick = { onItemClick(activityItem) })
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
}

@Composable
internal fun ActivityRow(item: ActivityItemDto, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(item.itemTitle) },
        supportingContent = {
            Text("${describeActivity(item)} · ${formatActivityDate(item.createdAt)}")
        },
        leadingContent = {
            AsyncImage(
                model = item.itemCoverUrl,
                contentDescription = null,
                modifier = Modifier.size(48.dp, 64.dp),
            )
        },
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    )
}
