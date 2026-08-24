package xyz.cqn.cqntrack.manga.ui

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
import xyz.cqn.cqntrack.manga.data.MangaSummaryDto

/** Sem entrypoint próprio — só alcançável a partir do link de autor em MangaDetailScreen. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthorDetailScreen(
    onMangaClick: (MangaSummaryDto) -> Unit,
    viewModel: AuthorDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.author?.name.orEmpty()) }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.author == null -> Text(
                text = uiState.errorMessage ?: "Autor não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            uiState.author!!.manga.isEmpty() -> Text(
                text = "Nenhum outro mangá encontrado desse autor.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(uiState.author!!.manga, key = { it.mangadexId }) { manga ->
                    ListItem(
                        headlineContent = { Text(manga.title) },
                        supportingContent = { Text(manga.authors.joinToString(", ") { it.name }) },
                        leadingContent = {
                            AsyncImage(
                                model = manga.coverUrl,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp, 64.dp),
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onMangaClick(manga) },
                    )
                }
            }
        }
    }
}
