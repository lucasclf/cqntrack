package xyz.cqn.cqntrack.manga.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
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
import androidx.lifecycle.compose.LifecycleResumeEffect
import xyz.cqn.cqntrack.manga.data.MangaListDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MangaListsScreen(
    onListClick: (MangaListDto) -> Unit,
    viewModel: MangaListsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showCreateDialog by remember { mutableStateOf(false) }

    // Ver comentário equivalente em BookListsScreen — recarrega ao voltar do
    // detalhe da lista, onde itemCount/exclusão podem ter mudado.
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        onPauseOrDispose { }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Minhas listas") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateDialog = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nova lista")
            }
        },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.lists.isEmpty() -> Text(
                text = uiState.errorMessage ?: "Nenhuma lista ainda. Toque em + pra criar uma.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(uiState.lists, key = { it.id }) { list ->
                    ListItem(
                        headlineContent = { Text(list.name) },
                        supportingContent = {
                            Text("${list.itemCount} ${if (list.itemCount == 1) "item" else "itens"}")
                        },
                        modifier = Modifier.fillMaxWidth().clickable { onListClick(list) },
                    )
                }
            }
        }
    }

    if (showCreateDialog) {
        MangaCreateListDialog(
            isCreating = uiState.isCreating,
            onDismiss = { showCreateDialog = false },
            onCreate = { name, description ->
                viewModel.createList(name, description)
                showCreateDialog = false
            },
        )
    }
}

@Composable
private fun MangaCreateListDialog(
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, description: String?) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nova lista") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Descrição (opcional)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && !isCreating,
                onClick = { onCreate(name.trim(), description.trim()) },
            ) { Text("Criar") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        },
    )
}
