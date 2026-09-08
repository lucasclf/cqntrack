package xyz.cqn.cqntrack.series.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
                    val updating = item.series.tmdbId in uiState.updatingSeriesIds
                    // key() força recriar o estado do swipe quando o item é substituído pelo
                    // próximo episódio (mesmo tmdbId, dado novo) — sem isso o SwipeToDismissBox
                    // ficaria "preso" na posição arrastada do episódio anterior.
                    key(item.nextEpisode.seasonNumber, item.nextEpisode.episodeNumber) {
                        val dismissState = rememberSwipeToDismissBoxState(
                            confirmValueChange = { value ->
                                if (!updating) {
                                    when (value) {
                                        SwipeToDismissBoxValue.EndToStart -> viewModel.markEpisodeWatched(item)
                                        // Só abre o diálogo de confirmação — abandonar de verdade só
                                        // acontece se o usuário confirmar (ver AlertDialog abaixo).
                                        SwipeToDismissBoxValue.StartToEnd -> viewModel.requestAbandon(item)
                                        SwipeToDismissBoxValue.Settled -> {}
                                    }
                                }
                                false // nunca sai de tela sozinho — a lista muda quando o servidor responde
                            },
                        )
                        SwipeToDismissBox(
                            state = dismissState,
                            enableDismissFromStartToEnd = !updating,
                            enableDismissFromEndToStart = !updating,
                            backgroundContent = {
                                val abandoning = dismissState.dismissDirection == SwipeToDismissBoxValue.StartToEnd
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(if (abandoning) Color(0xFFDC2626) else Color(0xFF16A34A))
                                        .padding(horizontal = 20.dp),
                                    contentAlignment = if (abandoning) Alignment.CenterStart else Alignment.CenterEnd,
                                ) {
                                    Icon(
                                        if (abandoning) Icons.Filled.Delete else Icons.Filled.Check,
                                        contentDescription = if (abandoning) "Abandonar série" else "Marcar como assistido",
                                        tint = Color.White,
                                    )
                                }
                            },
                        ) {
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
                                trailingContent = if (updating) {
                                    { CircularProgressIndicator(modifier = Modifier.size(20.dp)) }
                                } else {
                                    null
                                },
                                modifier = Modifier.fillMaxWidth().clickable { onItemClick(item) },
                            )
                        }
                    }
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

        val pendingAbandon = uiState.pendingAbandon
        if (pendingAbandon != null) {
            AlertDialog(
                onDismissRequest = viewModel::cancelAbandon,
                title = { Text("Abandonar série?") },
                text = { Text("Tem certeza que quer marcar \"${pendingAbandon.series.name}\" como abandonada? Ela vai sair de \"Continuar assistindo\".") },
                confirmButton = { TextButton(onClick = viewModel::confirmAbandon) { Text("Abandonar") } },
                dismissButton = { TextButton(onClick = viewModel::cancelAbandon) { Text("Cancelar") } },
            )
        }
    }
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" sem passar por Date — mesmo motivo de formatFullDate em ContinueWatching.tsx (evita bug de fuso). */
private fun formatFullDate(isoDate: String): String {
    val parts = isoDate.split("-")
    return if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else isoDate
}
