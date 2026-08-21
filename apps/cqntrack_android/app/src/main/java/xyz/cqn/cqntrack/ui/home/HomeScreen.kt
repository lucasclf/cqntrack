package xyz.cqn.cqntrack.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Índice das seções — equivalente simplificado da HomeTabs.tsx do web (só
 * navegação entre seções, sem os cards de "recente"/"favoritos" de cada
 * uma ainda). Uma seção nova precisa só de uma entrada aqui + um destino
 * em CqntrackNavHost.kt, mesmo espírito de MEDIA_TYPES no lado web.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenBooks: () -> Unit,
    onOpenMovies: () -> Unit,
    onOpenGames: () -> Unit,
    onOpenSeries: () -> Unit,
    onOpenManga: () -> Unit,
) {
    Scaffold(
        topBar = { TopAppBar(title = { Text("cqntrack") }) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            SectionButton("Livros", onOpenBooks)
            SectionButton("Filmes", onOpenMovies)
            SectionButton("Jogos", onOpenGames)
            SectionButton("Séries", onOpenSeries)
            SectionButton("Mangás", onOpenManga)
        }
    }
}

@Composable
private fun SectionButton(label: String, onClick: () -> Unit) {
    Button(onClick = onClick, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        Text(label)
    }
}
