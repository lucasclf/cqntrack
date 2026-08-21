package xyz.cqn.cqntrack.profile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.profile.data.FavoriteItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicProfileScreen(
    onFavoriteClick: (FavoriteItem) -> Unit,
    viewModel: PublicProfileViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.profile?.displayUsername ?: "Perfil") }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.profile == null -> Text(
                text = uiState.errorMessage ?: "Perfil não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> {
                val profile = uiState.profile!!
                Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        AsyncImage(
                            model = profile.image,
                            contentDescription = null,
                            modifier = Modifier.size(96.dp).clip(CircleShape),
                        )
                        Text(
                            "@${profile.displayUsername}",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                        // memberSince vem como ISO 8601 (z.iso.datetime()) — só a
                        // data interessa aqui, sem precisar de uma lib só pra isso.
                        Text(
                            "Membro desde ${profile.memberSince.take(10)}",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }

                    Text(
                        "Favoritos",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )

                    when {
                        uiState.favoritesLoading -> Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.Center,
                        ) { CircularProgressIndicator(modifier = Modifier.size(24.dp)) }

                        uiState.favorites.isEmpty() -> Text(
                            "Nenhum favorito ainda.",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(16.dp),
                        )

                        else -> LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            modifier = Modifier.fillMaxSize().padding(8.dp),
                        ) {
                            items(uiState.favorites, key = { "${it.mediaType}_${it.id}" }) { favorite ->
                                FavoriteCard(favorite = favorite, onClick = { onFavoriteClick(favorite) })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FavoriteCard(favorite: FavoriteItem, onClick: () -> Unit) {
    Column(modifier = Modifier.padding(8.dp).clickable(onClick = onClick)) {
        AsyncImage(
            model = favorite.imageUrl,
            contentDescription = null,
            modifier = Modifier.fillMaxWidth().size(120.dp),
        )
        Text(
            favorite.title,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
