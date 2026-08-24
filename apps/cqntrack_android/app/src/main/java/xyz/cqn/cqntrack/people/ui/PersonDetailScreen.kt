package xyz.cqn.cqntrack.people.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.people.data.PersonCreditItemDto
import xyz.cqn.cqntrack.people.data.PersonCreditMediaType

/** Sem entrypoint próprio — só alcançável a partir de CastSection/CrewSection em MovieDetail/SeriesDetail. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PersonDetailScreen(
    onCreditClick: (mediaType: PersonCreditMediaType, id: Int) -> Unit,
    viewModel: PersonDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.detail?.person?.name.orEmpty()) }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.detail == null -> Text(
                text = uiState.errorMessage ?: "Pessoa não encontrada.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> {
                val detail = uiState.detail!!
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 8.dp),
                ) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Column(modifier = Modifier.padding(8.dp)) {
                            AsyncImage(
                                model = detail.person.profileUrl,
                                contentDescription = null,
                                modifier = Modifier.size(96.dp, 128.dp),
                            )
                            if (detail.person.biography != null) {
                                Text(
                                    text = detail.person.biography,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 12.dp),
                                )
                            }
                        }
                    }

                    if (detail.actingCredits.isEmpty() && detail.directingCredits.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                "Nenhum crédito de ator ou diretor encontrado.",
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                    }

                    if (detail.actingCredits.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                "Como ator",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                        items(detail.actingCredits, key = { "acting-${it.mediaType}-${it.id}" }) { credit ->
                            CreditCard(credit = credit, onClick = { onCreditClick(credit.mediaType, credit.id) })
                        }
                    }

                    if (detail.directingCredits.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                "Como diretor",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                        items(detail.directingCredits, key = { "directing-${it.mediaType}-${it.id}" }) { credit ->
                            CreditCard(credit = credit, onClick = { onCreditClick(credit.mediaType, credit.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CreditCard(credit: PersonCreditItemDto, onClick: () -> Unit) {
    Column(modifier = Modifier.padding(8.dp).fillMaxWidth().clickable(onClick = onClick)) {
        AsyncImage(
            model = credit.posterUrl,
            contentDescription = null,
            modifier = Modifier.fillMaxWidth().size(140.dp),
        )
        Text(
            credit.title,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
        val year = credit.releaseDate?.take(4)
        Text(
            if (year != null) "${credit.roleLabel} · $year" else credit.roleLabel,
            style = MaterialTheme.typography.labelSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
