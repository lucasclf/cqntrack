package xyz.cqn.cqntrack.manga.ui

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
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
import xyz.cqn.cqntrack.manga.data.MangaChapterDto
import xyz.cqn.cqntrack.manga.data.MangaStatus

private val STATUS_LABELS = mapOf(
    MangaStatus.WantToRead to "Quero ler",
    MangaStatus.Reading to "Lendo",
    MangaStatus.Read to "Lido",
    MangaStatus.Dropped to "Abandonado",
)

// "Volume 0" é o sentinela de "sem volume atribuído" (capítulo avulso na
// MangaDex) — mostrado como "Avulsos", que confundiria menos.
private fun volumeLabel(volumeNumber: Int): String =
    if (volumeNumber == 0) "Avulsos" else "Volume $volumeNumber"

// Sentinela -1 pro capítulo sem número (oneshot/doujinshi) — ver
// chapters.service.ts no backend pro racional completo. Números inteiros
// (10.0) são exibidos sem casa decimal ("Capítulo 10"); decimais reais
// (10.5, capítulo bônus) mantêm a casa ("Capítulo 10.5").
private fun chapterLabel(chapterNumber: Double): String {
    if (chapterNumber == -1.0) return "Extra"
    val display = if (chapterNumber == chapterNumber.toLong().toDouble()) {
        chapterNumber.toLong().toString()
    } else {
        chapterNumber.toString()
    }
    return "Capítulo $display"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MangaDetailScreen(
    onBack: () -> Unit,
    viewModel: MangaDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(uiState.manga?.title.orEmpty()) }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.manga == null -> Text(
                text = uiState.errorMessage ?: "Mangá não encontrado.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            // Uma LazyColumn só pra tela inteira — descrição da MangaDex pode ser
            // longa o bastante (e não vem traduzida pra pt-BR, ao contrário da
            // TMDB) pra estourar a altura de uma Column comum sem scroll próprio,
            // empurrando "Marcar volume inteiro"/capítulos/Voltar pra fora da tela
            // sem jeito de rolar até lá (bug real encontrado testando contra a API
            // de verdade com "Death Note"). Cabeçalho e capítulos precisam
            // compartilhar o mesmo scroll.
            else -> {
                val manga = uiState.manga!!
                LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                    item {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row {
                                AsyncImage(
                                    model = manga.coverUrl,
                                    contentDescription = null,
                                    modifier = Modifier.size(96.dp, 128.dp),
                                )
                                Column(modifier = Modifier.padding(start = 16.dp)) {
                                    Text(manga.title, style = MaterialTheme.typography.titleLarge)
                                    Text(
                                        manga.authors.joinToString(", ") { it.name },
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                    val read = uiState.entry?.readChapterCount ?: 0
                                    Text("$read capítulos lidos", style = MaterialTheme.typography.bodySmall)
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

                            Row(modifier = Modifier.padding(top = 16.dp)) {
                                STATUS_LABELS.forEach { (status, label) ->
                                    FilterChip(
                                        selected = uiState.entry?.status == status,
                                        onClick = { viewModel.setStatus(status) },
                                        label = { Text(label) },
                                        modifier = Modifier.padding(end = 8.dp),
                                    )
                                }
                            }

                            if (manga.description != null) {
                                Text(
                                    text = manga.description,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 16.dp),
                                )
                            }

                            if (uiState.errorMessage != null) {
                                Text(
                                    text = uiState.errorMessage.orEmpty(),
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(top = 16.dp),
                                )
                            }
                        }
                    }

                    if (uiState.volumesLoading) {
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.Center,
                            ) { CircularProgressIndicator(modifier = Modifier.size(24.dp)) }
                        }
                    } else if (uiState.volumes.isNotEmpty()) {
                        item {
                            Text(
                                "Capítulos",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                            Row(
                                modifier = Modifier
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                                    .horizontalScroll(rememberScrollState()),
                            ) {
                                uiState.volumes.forEach { volume ->
                                    FilterChip(
                                        selected = uiState.selectedVolume == volume.volumeNumber,
                                        onClick = { viewModel.selectVolume(volume.volumeNumber) },
                                        label = { Text(volumeLabel(volume.volumeNumber)) },
                                        modifier = Modifier.padding(end = 8.dp),
                                    )
                                }
                            }
                        }

                        val selected = uiState.volumes.find { it.volumeNumber == uiState.selectedVolume }
                        if (selected != null) {
                            item {
                                val allRead = selected.chapters.isNotEmpty() && selected.chapters.all { it.read }
                                Button(
                                    onClick = viewModel::toggleVolume,
                                    enabled = !uiState.volumeActionPending,
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                                ) {
                                    Text(if (allRead) "Desmarcar volume inteiro" else "Marcar volume inteiro")
                                }
                            }

                            items(selected.chapters, key = { it.chapterNumber }) { chapter ->
                                ChapterRow(
                                    chapter = chapter,
                                    onToggle = { read ->
                                        viewModel.toggleChapter(selected.volumeNumber, chapter.chapterNumber, read)
                                    },
                                )
                            }
                        }
                    }

                    item {
                        Button(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Voltar")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChapterRow(chapter: MangaChapterDto, onToggle: (Boolean) -> Unit) {
    ListItem(
        headlineContent = { Text(chapterLabel(chapter.chapterNumber)) },
        trailingContent = {
            Checkbox(checked = chapter.read, onCheckedChange = onToggle)
        },
    )
}
