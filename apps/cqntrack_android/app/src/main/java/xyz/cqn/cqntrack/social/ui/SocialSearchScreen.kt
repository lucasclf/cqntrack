package xyz.cqn.cqntrack.social.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.social.data.FollowedUserDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialSearchScreen(
    onUserClick: (String) -> Unit,
    viewModel: SocialSearchViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Procurar") }) },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            item {
                OutlinedTextField(
                    value = uiState.query,
                    onValueChange = viewModel::onQueryChange,
                    label = { Text("Buscar por username ou nome") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
            }

            if (uiState.errorMessage != null) {
                item {
                    Text(
                        text = uiState.errorMessage.orEmpty(),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }

            if (!uiState.isLoading && uiState.items.isEmpty()) {
                item {
                    Text("Nenhum usuário encontrado.", modifier = Modifier.padding(16.dp))
                }
            }

            items(uiState.items, key = { it.username }) { user ->
                SocialSearchRow(
                    user = user,
                    viewerUsername = uiState.viewerUsername,
                    onClick = { onUserClick(user.username) },
                )
            }

            if (uiState.isLoading) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.Center,
                    ) { CircularProgressIndicator() }
                }
            } else if (uiState.hasMore) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.Center,
                    ) { TextButton(onClick = viewModel::loadMore) { Text("Carregar mais") } }
                }
            }
        }
    }
}

@Composable
private fun SocialSearchRow(user: FollowedUserDto, viewerUsername: String?, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(user.displayUsername) },
        leadingContent = {
            AsyncImage(
                model = user.image,
                contentDescription = null,
                modifier = Modifier.size(40.dp).clip(CircleShape),
            )
        },
        trailingContent = { FollowButton(username = user.username, viewerUsername = viewerUsername) },
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    )
}
