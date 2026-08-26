package xyz.cqn.cqntrack.social.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.social.data.FollowedUserDto

/**
 * Tela de entrada de NavRoutes.SOCIAL — aba "Listar" (avatar+nome de quem você segue, ver
 * SocialFollowingViewModel), com ações no topo pra Atividades e Procurar (mesma ideia de
 * onSearchClick/onListsClick/onEntriesClick já usada em GameDiscoverScreen e afins).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialFollowingScreen(
    onUserClick: (String) -> Unit,
    onActivityClick: () -> Unit,
    onSearchClick: () -> Unit,
    viewModel: SocialFollowingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Social") },
                actions = {
                    TextButton(onClick = onActivityClick) { Text("Atividades") }
                    TextButton(onClick = onSearchClick) { Text("Procurar") }
                },
            )
        },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.errorMessage != null -> Text(
                text = uiState.errorMessage.orEmpty(),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            uiState.items.isEmpty() -> Text(
                text = "Você ainda não segue ninguém.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize().padding(padding).padding(8.dp),
            ) {
                items(uiState.items, key = { it.username }) { user ->
                    FollowedUserCard(user = user, onClick = { onUserClick(user.username) })
                }
            }
        }
    }
}

@Composable
private fun FollowedUserCard(user: FollowedUserDto, onClick: () -> Unit) {
    Column(
        modifier = Modifier.padding(8.dp).fillMaxWidth().clickable(onClick = onClick),
    ) {
        AsyncImage(
            model = user.image,
            contentDescription = null,
            modifier = Modifier.width(64.dp).size(64.dp).clip(CircleShape),
        )
        Text(
            user.displayUsername,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
