package xyz.cqn.cqntrack.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Marca do cqntrack: o gato tuxedo de casa, sentado com o rabo enrolado. Tradução direta
 * do `CatMark.tsx` do web (mesmo viewBox 0 0 64 64), desenhada via Canvas. [eyes] deve ser
 * igual ao fundo atrás da marca — os olhos são "vazados", como no web.
 * [simple] tira focinho, nariz e olhos pra tamanhos muito pequenos.
 */
@Composable
fun CatMark(
    eyes: Color,
    modifier: Modifier = Modifier,
    fur: Color = MarkFur,
    chest: Color = MarkChest,
    nose: Color = MarkNose,
    simple: Boolean = false,
) {
    Canvas(modifier) {
        val s = size.minDimension / 64f
        fun o(x: Float, y: Float) = Offset(x * s, y * s)

        val tail = Path().apply {
            moveTo(44f * s, 55f * s)
            cubicTo(56f * s, 55f * s, 58f * s, 39f * s, 48f * s, 35f * s)
        }
        drawPath(tail, fur, style = Stroke(width = 5.5f * s, cap = StrokeCap.Round))
        drawOval(fur, topLeft = o(14f, 33.5f), size = Size(32f * s, 27f * s))
        drawCircle(fur, radius = 12f * s, center = o(30f, 25f))
        drawPath(Path().apply { moveTo(20.5f * s, 21f * s); lineTo(18f * s, 8f * s); lineTo(27.5f * s, 15f * s); close() }, fur)
        drawPath(Path().apply { moveTo(39.5f * s, 21f * s); lineTo(42f * s, 8f * s); lineTo(32.5f * s, 15f * s); close() }, fur)

        val bib = Path().apply {
            moveTo(30f * s, 35f * s)
            cubicTo(25f * s, 41f * s, 25f * s, 52f * s, 30f * s, 59f * s)
            cubicTo(35f * s, 52f * s, 35f * s, 41f * s, 30f * s, 35f * s)
            close()
        }
        drawPath(bib, chest)

        if (!simple) {
            val muzzle = Path().apply {
                moveTo(30f * s, 24f * s)
                cubicTo(26.5f * s, 28f * s, 24f * s, 31f * s, 25f * s, 33.5f * s)
                cubicTo(27f * s, 35.6f * s, 33f * s, 35.6f * s, 35f * s, 33.5f * s)
                cubicTo(36f * s, 31f * s, 33.5f * s, 28f * s, 30f * s, 24f * s)
                close()
            }
            drawPath(muzzle, chest)
            drawPath(Path().apply { moveTo(28.5f * s, 28.8f * s); lineTo(31.5f * s, 28.8f * s); lineTo(30f * s, 30.7f * s); close() }, nose)
            drawOval(eyes, topLeft = o(22.7f, 21.9f), size = Size(3.8f * s, 3f * s))
            drawOval(eyes, topLeft = o(33.5f, 21.9f), size = Size(3.8f * s, 3f * s))
        }
    }
}

/** A marca dentro do quadrado violeta (mesmo `.brandMark` do web). */
@Composable
fun CatMarkBadge(modifier: Modifier = Modifier, size: Dp = 32.dp) {
    val bg = MaterialTheme.colorScheme.primary
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.3f))
            .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        CatMark(eyes = bg, modifier = Modifier.size(size * 0.78f), simple = size < 24.dp)
    }
}

/** Nome em minúsculas, com "track" na cor de destaque — igual ao web. */
@Composable
fun Wordmark(modifier: Modifier = Modifier, fontSize: TextUnit = 20.sp) {
    val accent = MaterialTheme.colorScheme.primary
    Text(
        text = buildAnnotatedString {
            append("cqn")
            withStyle(SpanStyle(color = accent)) { append("track") }
        },
        modifier = modifier,
        fontSize = fontSize,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.03).em,
    )
}

/** Marca + nome lado a lado (cabeçalhos, login). */
@Composable
fun BrandLockup(modifier: Modifier = Modifier, markSize: Dp = 32.dp, fontSize: TextUnit = 20.sp) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CatMarkBadge(size = markSize)
        Wordmark(fontSize = fontSize)
    }
}
