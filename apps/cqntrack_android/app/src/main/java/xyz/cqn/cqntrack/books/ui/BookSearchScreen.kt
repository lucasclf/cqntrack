package xyz.cqn.cqntrack.books.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.List
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import xyz.cqn.cqntrack.books.data.BookSummaryDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookSearchScreen(
    onBookClick: (BookSummaryDto) -> Unit,
    onListsClick: () -> Unit,
    onEntriesClick: () -> Unit,
    viewModel: BookSearchViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Livros") },
                actions = {
                    IconButton(onClick = onEntriesClick) {
                        Icon(Icons.Filled.Checklist, contentDescription = "Minhas marcações")
                    }
                    IconButton(onClick = onListsClick) {
                        Icon(Icons.Filled.List, contentDescription = "Minhas listas")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            OutlinedTextField(
                value = uiState.query,
                onValueChange = viewModel::onQueryChange,
                label = { Text("Buscar por título...") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            )

            when {
                uiState.isLoading -> Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                }

                uiState.errorMessage != null -> Text(
                    text = uiState.errorMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp),
                )

                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(uiState.results, key = { it.googleBooksId }) { book ->
                        BookRow(book = book, onClick = { onBookClick(book) })
                    }
                }
            }
        }
    }
}

@Composable
private fun BookRow(book: BookSummaryDto, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(book.title) },
        supportingContent = { Text(book.authors.joinToString(", ")) },
        leadingContent = {
            AsyncImage(
                model = book.coverUrl,
                contentDescription = null,
                modifier = Modifier.size(48.dp, 64.dp),
            )
        },
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    )
}
