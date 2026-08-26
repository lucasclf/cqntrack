package xyz.cqn.cqntrack.social.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import xyz.cqn.cqntrack.activity.describeActivity
import xyz.cqn.cqntrack.activity.formatActivityDate
import xyz.cqn.cqntrack.social.data.FriendActivityItemDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialActivityScreen(
    onItemClick: (FriendActivityItemDto) -> Unit,
    onAuthorClick: (String) -> Unit,
    viewModel: SocialActivityViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Atividades dos amigos") }) },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
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
                    Text(
                        "Nenhuma atividade por aqui ainda — siga alguém pra ver o que anda fazendo.",
                        modifier = Modifier.padding(16.dp),
                    )
                }

                else -> {
                    items(uiState.items, key = { it.id }) { friendItem ->
                        Column {
                            Row(
                                modifier = Modifier
                                    .padding(start = 16.dp, top = 8.dp)
                                    .clickable { onAuthorClick(friendItem.author.username) },
                            ) {
                                AsyncImage(
                                    model = friendItem.author.image,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp).clip(CircleShape),
                                )
                                Text(
                                    friendItem.author.displayUsername,
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.padding(start = 8.dp),
                                )
                            }
                            ListItem(
                                headlineContent = { Text(friendItem.itemTitle) },
                                supportingContent = {
                                    Text("${describeActivity(friendItem)} · ${formatActivityDate(friendItem.createdAt)}")
                                },
                                leadingContent = {
                                    AsyncImage(
                                        model = friendItem.itemCoverUrl,
                                        contentDescription = null,
                                        modifier = Modifier.size(48.dp, 64.dp),
                                    )
                                },
                                modifier = Modifier.fillMaxWidth().clickable { onItemClick(friendItem) },
                            )
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
        }
    }
}
