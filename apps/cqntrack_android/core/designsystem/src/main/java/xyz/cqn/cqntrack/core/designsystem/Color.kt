package xyz.cqn.cqntrack.core.designsystem

import androidx.compose.ui.graphics.Color

// Paleta alinhada à identidade visual do cqntrack web (ver apps/cqntrack_fe/src/theme.css
// e apps/cqntrack_fe/public/favicon.svg — violet-600/700 no claro, violet-400/500 no escuro).
val Primary = Color(0xFF7C3AED) // --accent (light) / violet-600
val OnPrimary = Color(0xFFFFFFFF) // --on-accent (light)
val Secondary = Color(0xFF625A80) // --text-secondary (light)
val Background = Color(0xFFFAF9FE) // --bg (light)
val OnBackground = Color(0xFF1D1730) // --text-primary (light)
val Surface = Color(0xFFF3F0FC) // --panel-bg (light)
val OnSurface = Color(0xFF1D1730) // --text-primary (light)
val Error = Color(0xFFDC2626) // --error (light)
// Segundo tom do gradiente dos tiles da Home (ver HomeScreen.kt) — não é um slot do
// Material ColorScheme padrão, por isso fica solto aqui em vez de dentro do lightColorScheme.
val AccentStrong = Color(0xFF6D28D9) // violet-700 (light)

val PrimaryDark = Color(0xFFA78BFA) // --accent (dark) / violet-400
val OnPrimaryDark = Color(0xFF140B29) // --on-accent (dark)
val SecondaryDark = Color(0xFFA79BC9) // --text-secondary (dark)
val BackgroundDark = Color(0xFF0E0A18) // --bg (dark)
val OnBackgroundDark = Color(0xFFF5F2FF) // --text-primary (dark)
val SurfaceDark = Color(0xFF161027) // --panel-bg (dark)
val OnSurfaceDark = Color(0xFFF5F2FF) // --text-primary (dark)
val ErrorDark = Color(0xFFF87171) // --error (dark)
val AccentStrongDark = Color(0xFF8B5CF6) // violet-500 (dark)

// ---- Nova identidade visual (ver canvas "cqnTrack — nova identidade visual" e theme.css) ----

// Marca: o gato tuxedo de casa — pelo, peito/focinho e nariz (ver CatMark.kt).
val MarkFur = Color(0xFF140B29)
val MarkChest = Color(0xFFF5F2FF)
val MarkNose = Color(0xFFF4A3B5)

// Rosa do focinho: favoritos (antes usavam a cor de erro). Tom mais escuro no claro pra
// manter contraste sobre fundo branco — mesmos valores de --favorite no web.
val Favorite = Color(0xFFC2416B)
val FavoriteDark = Color(0xFFF4A3B5)

// Uma cor por seção de mídia (iguais a --media-* no web, tema escuro). Usadas como fundo
// sólido dos tiles da Home, com o ícone em MarkFur por cima — legível nos dois temas.
val MediaSeries = Color(0xFF7CB4FF)
val MediaMovies = Color(0xFFFFA26B)
val MediaGames = Color(0xFFA78BFA)
val MediaBooks = Color(0xFFF2CF66)
val MediaManga = Color(0xFF5ED6D0)
// Atividades (tile da Home): lavanda neutra; Social usa o rosa do focinho (MarkNose).
val MediaActivity = Color(0xFFB9AEDB)
