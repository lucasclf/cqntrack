package xyz.cqn.cqntrack.games.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.games.data.GameSummaryDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameListDetailScreen(
    onBack: () -> Unit,
    onGameClick: (GameSummaryDto) -> Unit,
    viewModel: GameListDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDeleteConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isDeleted) {
        if (uiState.isDeleted) onBack()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.list?.name ?: "Lista") },
                actions = {
                    IconButton(onClick = { showDeleteConfirm = true }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Excluir lista")
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

            uiState.list == null -> Text(
                text = uiState.errorMessage ?: "Lista não encontrada.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            uiState.list!!.items.isEmpty() -> Text(
                text = "Essa lista ainda não tem itens.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(uiState.list!!.items, key = { it.igdbId }) { game ->
                    ListItem(
                        headlineContent = { Text(game.name) },
                        supportingContent = { Text(game.platforms.joinToString(", ")) },
                        leadingContent = {
                            AsyncImage(
                                model = game.coverUrl,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp, 64.dp),
                            )
                        },
                        trailingContent = {
                            IconButton(onClick = { viewModel.removeItem(game.igdbId) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Remover da lista")
                            }
                        },
                        modifier = Modifier.fillMaxWidth().clickable { onGameClick(game) },
                    )
                }
            }
        }

        if (uiState.errorMessage != null && uiState.list != null) {
            Text(
                text = uiState.errorMessage.orEmpty(),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(padding).padding(16.dp),
            )
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Excluir lista?") },
            text = { Text("Essa ação não pode ser desfeita.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.deleteList()
                }) { Text("Excluir") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancelar") }
            },
        )
    }
}
