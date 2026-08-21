package xyz.cqn.cqntrack.games.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.core.designsystem.StarRating
import xyz.cqn.cqntrack.games.data.GameListDto
import xyz.cqn.cqntrack.games.data.GameStatus

private val STATUS_LABELS = mapOf(
    GameStatus.NotStarted to "Quero jogar",
    GameStatus.Playing to "Jogando",
    GameStatus.Dropped to "Abandonado",
    GameStatus.Completed to "Finalizado",
    GameStatus.Platinum to "Platinado",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameDetailScreen(
    onBack: () -> Unit,
    viewModel: GameDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.game?.name.orEmpty()) },
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

            uiState.game == null -> Text(
                text = uiState.errorMessage ?: "Jogo não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .pointerInput(Unit) {
                        detectTapGestures(onTap = { focusManager.clearFocus() })
                    }
                    .padding(16.dp),
            ) {
                val game = uiState.game!!
                Row {
                    AsyncImage(
                        model = game.coverUrl,
                        contentDescription = null,
                        modifier = Modifier.size(96.dp, 128.dp),
                    )
                    Column(modifier = Modifier.padding(start = 16.dp)) {
                        Text(game.name, style = MaterialTheme.typography.titleLarge)
                        Text(game.platforms.joinToString(", "), style = MaterialTheme.typography.bodyMedium)
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

                Row(
                    modifier = Modifier
                        .padding(top = 16.dp)
                        .horizontalScroll(rememberScrollState()),
                ) {
                    STATUS_LABELS.forEach { (status, label) ->
                        FilterChip(
                            selected = uiState.entry?.status == status,
                            onClick = { viewModel.setStatus(status) },
                            label = { Text(label) },
                            modifier = Modifier.padding(end = 8.dp),
                        )
                    }
                }

                StarRating(
                    value = uiState.entry?.rating,
                    onChange = viewModel::setRating,
                    modifier = Modifier.padding(top = 12.dp),
                )

                if (game.summary != null) {
                    Text(
                        text = game.summary,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }

                var reviewDraft by remember(uiState.entry?.review) {
                    mutableStateOf(uiState.entry?.review.orEmpty())
                }
                OutlinedTextField(
                    value = reviewDraft,
                    onValueChange = { reviewDraft = it },
                    label = { Text("Review") },
                    minLines = 3,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp)
                        .onFocusChanged { focusState ->
                            if (!focusState.isFocused && reviewDraft != uiState.entry?.review.orEmpty()) {
                                viewModel.setReview(reviewDraft.ifBlank { null })
                            }
                        },
                )

                if (uiState.errorMessage != null) {
                    Text(
                        text = uiState.errorMessage.orEmpty(),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }

                if (uiState.entry != null) {
                    TextButton(
                        onClick = viewModel::removeEntry,
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Text("Remover marcação")
                    }
                }

                Button(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(top = 24.dp)) {
                    Text("Voltar")
                }
            }
        }
    }

    if (uiState.showAddToListDialog) {
        GameAddToListDialog(
            lists = uiState.availableLists,
            errorMessage = uiState.addToListMessage,
            onDismiss = viewModel::closeAddToListDialog,
            onListSelected = viewModel::addToList,
            onCreateAndAdd = viewModel::createListAndAdd,
        )
    }
}

@Composable
private fun GameAddToListDialog(
    lists: List<GameListDto>,
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
