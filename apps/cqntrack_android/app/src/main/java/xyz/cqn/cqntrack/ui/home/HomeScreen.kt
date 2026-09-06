package xyz.cqn.cqntrack.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import xyz.cqn.cqntrack.core.designsystem.AccentStrong
import xyz.cqn.cqntrack.core.designsystem.AccentStrongDark
import xyz.cqn.cqntrack.core.designsystem.AtividadesIcon
import xyz.cqn.cqntrack.core.designsystem.ContinuarIcon
import xyz.cqn.cqntrack.core.designsystem.FilmesIcon
import xyz.cqn.cqntrack.core.designsystem.JogosIcon
import xyz.cqn.cqntrack.core.designsystem.LivrosIcon
import xyz.cqn.cqntrack.core.designsystem.MangasIcon
import xyz.cqn.cqntrack.core.designsystem.SeriesIcon
import xyz.cqn.cqntrack.core.designsystem.SocialIcon

/**
 * Grade de categorias — substitui a antiga lista de botões de texto (ver
 * histórico do arquivo) por ícones quadrados, um por seção, aprovados via
 * POC em HTML antes desta implementação. Cada ícone é um desenho próprio
 * (gato da marca fantasiado, ou só a patinha dele — ver CategoryIcons.kt
 * em core:designsystem), não um Material Icon genérico. Uma seção nova
 * precisa de uma entrada em CATEGORIES aqui + um ícone novo + um destino
 * em CqntrackNavHost.kt.
 */
private data class HomeCategory(
    val label: String,
    val icon: @Composable (tint: Color, cut: Color, modifier: Modifier) -> Unit,
    val onClick: () -> Unit,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenContinueWatching: () -> Unit,
    onOpenBooks: () -> Unit,
    onOpenMovies: () -> Unit,
    onOpenGames: () -> Unit,
    onOpenSeries: () -> Unit,
    onOpenManga: () -> Unit,
    onOpenActivity: () -> Unit,
    onOpenSocial: () -> Unit,
    onOpenAccount: () -> Unit,
) {
    val categories = listOf(
        HomeCategory("Continuar", { tint, cut, mod -> ContinuarIcon(tint, cut, mod) }, onOpenContinueWatching),
        HomeCategory("Livros", { tint, cut, mod -> LivrosIcon(tint, cut, mod) }, onOpenBooks),
        HomeCategory("Filmes", { tint, cut, mod -> FilmesIcon(tint, cut, mod) }, onOpenMovies),
        HomeCategory("Jogos", { tint, cut, mod -> JogosIcon(tint, cut, mod) }, onOpenGames),
        HomeCategory("Séries", { tint, cut, mod -> SeriesIcon(tint, cut, mod) }, onOpenSeries),
        HomeCategory("Mangás", { tint, cut, mod -> MangasIcon(tint, cut, mod) }, onOpenManga),
        HomeCategory("Atividades", { tint, cut, mod -> AtividadesIcon(tint, cut, mod) }, onOpenActivity),
        HomeCategory("Social", { tint, cut, mod -> SocialIcon(tint, cut, mod) }, onOpenSocial),
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("cqntrack") },
                actions = {
                    IconButton(onClick = onOpenAccount) {
                        Icon(Icons.Filled.AccountCircle, contentDescription = "Minha conta")
                    }
                },
            )
        },
    ) { padding ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(categories) { category ->
                CategoryTile(category)
            }
        }
    }
}

@Composable
private fun CategoryTile(category: HomeCategory) {
    val tileStart = MaterialTheme.colorScheme.primary
    val tileEnd = if (isSystemInDarkTheme()) AccentStrongDark else AccentStrong
    val onTile = MaterialTheme.colorScheme.onPrimary

    Column(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(tileStart, tileEnd)))
            .clickable(onClick = category.onClick)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        category.icon(onTile, tileStart, Modifier.size(40.dp))
        Text(
            text = category.label,
            color = onTile,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
