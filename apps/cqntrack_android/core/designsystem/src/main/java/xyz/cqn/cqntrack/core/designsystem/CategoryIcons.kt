package xyz.cqn.cqntrack.core.designsystem

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb

/**
 * Ícones da grade da Home (ver HomeScreen.kt) — desenhados à mão via Canvas em vez de
 * VectorDrawable porque a maioria mistura formas (gato/patinha) com "recortes" coloridos
 * (`cut`, simulando um furo mostrando o fundo do tile por trás — mesma linguagem visual dos
 * olhos do favicon.svg real). O sistema de coordenadas local é o mesmo do mockup em HTML
 * aprovado (viewBox "-1.5 -1.5 27 27") — cada função aqui é a tradução direta de um `<svg>`
 * daquele protótipo, não um desenho novo.
 */

private fun DrawScope.px(originX: Float, originY: Float, scale: Float, lx: Float, ly: Float): Offset {
    val s = size.minDimension / 27f
    return Offset((originX + lx * scale + 1.5f) * s, (originY + ly * scale + 1.5f) * s)
}

// A Path do Compose só aceita x/y separados — essas sobrecargas deixam usar px() (que devolve
// Offset) direto nas chamadas, sem destructuring repetido em cada ponto.
private fun Path.moveTo(o: Offset) = moveTo(o.x, o.y)
private fun Path.lineTo(o: Offset) = lineTo(o.x, o.y)
private fun Path.cubicTo(c1: Offset, c2: Offset, end: Offset) = cubicTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)

private fun DrawScope.len(scale: Float, l: Float): Float = l * scale * (size.minDimension / 27f)

/** Cabeça do gatinho (orelhas + cabeça + olhos-recorte) — sem corpo, usada em Livros/Jogos/Séries/Mangás. */
private fun DrawScope.catFace(originX: Float, originY: Float, scale: Float, tint: Color, cut: Color) {
    fun p(lx: Float, ly: Float) = px(originX, originY, scale, lx, ly)
    val ear1 = Path().apply { moveTo(p(7.4f, 8.1f)); lineTo(p(6.3f, 3.6f)); lineTo(p(10.2f, 6.3f)); close() }
    val ear2 = Path().apply { moveTo(p(14.6f, 8.1f)); lineTo(p(15.7f, 3.6f)); lineTo(p(11.8f, 6.3f)); close() }
    drawPath(ear1, tint)
    drawPath(ear2, tint)
    drawCircle(tint, radius = len(scale, 4.6f), center = p(11f, 9.6f))
    drawCircle(cut, radius = len(scale, .85f), center = p(9.4f, 9.4f))
    drawCircle(cut, radius = len(scale, .85f), center = p(12.6f, 9.4f))
}

/** Gato inteiro (cabeça + corpo, sem rabo) — usado em Social. */
private fun DrawScope.catFull(originX: Float, originY: Float, scale: Float, tint: Color, cut: Color) {
    catFace(originX, originY, scale, tint, cut)
    fun p(lx: Float, ly: Float) = px(originX, originY, scale, lx, ly)
    drawOval(
        tint,
        topLeft = Offset(p(11f, 18.2f).x - len(scale, 6.2f), p(11f, 18.2f).y - len(scale, 5.3f)),
        size = androidx.compose.ui.geometry.Size(len(scale, 12.4f), len(scale, 10.6f)),
    )
}

/** Patinha (uma almofada + 4 dedos) — Continuar, Filmes (carimbo pequeno) e Atividades. */
private fun DrawScope.paw(originX: Float, originY: Float, scale: Float, tint: Color) {
    fun p(lx: Float, ly: Float) = px(originX, originY, scale, lx, ly)
    fun oval(cx: Float, cy: Float, rx: Float, ry: Float, rotation: Float) {
        val center = p(cx, cy)
        val w = len(scale, rx * 2)
        val h = len(scale, ry * 2)
        rotate(rotation, pivot = center) {
            drawOval(tint, topLeft = Offset(center.x - w / 2, center.y - h / 2), size = androidx.compose.ui.geometry.Size(w, h))
        }
    }
    oval(11f, 16f, 5.6f, 4.7f, 0f)
    oval(4.4f, 9.2f, 2.3f, 2.9f, -18f)
    oval(9.4f, 6f, 2.4f, 3f, -6f)
    oval(14.6f, 6.3f, 2.3f, 2.9f, 6f)
    oval(19.4f, 9.8f, 2.1f, 2.7f, 20f)
}

@Composable
fun ContinuarIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        paw(0f, 0f, 1f, tint)
        val play = Path().apply {
            moveTo(px(0f, 0f, 1f, 9.2f, 14f))
            lineTo(px(0f, 0f, 1f, 9.2f, 18f))
            lineTo(px(0f, 0f, 1f, 12.6f, 16f))
            close()
        }
        drawPath(play, cut)
    }
}

@Composable
fun LivrosIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        catFace(0f, -2.4f, 1f, tint, cut)
        fun p(x: Float, y: Float) = px(0f, 0f, 1f, x, y)
        val pageLeft = Path().apply {
            moveTo(p(2.8f, 13.6f))
            cubicTo(p(5.4f, 12.1f), p(8.0f, 12.1f), p(11.0f, 13.6f))
            lineTo(p(11.0f, 21.4f))
            cubicTo(p(8.0f, 19.9f), p(5.4f, 19.9f), p(2.8f, 21.4f))
            close()
        }
        val pageRight = Path().apply {
            moveTo(p(19.2f, 13.6f))
            cubicTo(p(16.6f, 12.1f), p(14.0f, 12.1f), p(11.0f, 13.6f))
            lineTo(p(11.0f, 21.4f))
            cubicTo(p(14.0f, 19.9f), p(16.6f, 19.9f), p(19.2f, 21.4f))
            close()
        }
        drawPath(pageLeft, tint)
        drawPath(pageRight, tint)
    }
}

@Composable
fun FilmesIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        fun p(x: Float, y: Float) = px(0f, 0f, 1f, x, y)
        drawRoundRect(
            tint,
            topLeft = p(4f, 9f),
            size = androidx.compose.ui.geometry.Size(len(1f, 16f), len(1f, 11f)),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(len(1f, 1.6f)),
        )
        val stripe1 = Path().apply { moveTo(p(4f, 9f)); lineTo(p(5.5f, 4.5f)); lineTo(p(9.5f, 6.1f)); lineTo(p(8f, 9f)); close() }
        val stripe2 = Path().apply { moveTo(p(9.5f, 9f)); lineTo(p(10.5f, 4.8f)); lineTo(p(14.5f, 6.4f)); lineTo(p(13.5f, 9f)); close() }
        val stripe3 = Path().apply { moveTo(p(15f, 9f)); lineTo(p(15.7f, 5.3f)); lineTo(p(19.2f, 6.7f)); lineTo(p(18.5f, 9f)); close() }
        drawPath(stripe1, tint); drawPath(stripe2, tint); drawPath(stripe3, tint)
        paw(7.6f, 10.8f, .34f, cut)
    }
}

@Composable
fun JogosIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        catFace(0f, -2.4f, 1f, tint, cut)
        fun p(x: Float, y: Float) = px(0f, 0f, 1f, x, y)
        val body = Path().apply {
            moveTo(p(3f, 15.8f))
            cubicTo(p(1.8f, 16.8f), p(1.4f, 19.1f), p(2.2f, 20.7f))
            cubicTo(p(2.8f, 21.9f), p(4.0f, 22.1f), p(4.8f, 21.2f))
            lineTo(p(6.3f, 19.6f))
            lineTo(p(15.7f, 19.6f))
            lineTo(p(17.2f, 21.2f))
            cubicTo(p(18.0f, 22.1f), p(19.2f, 21.9f), p(19.8f, 20.7f))
            cubicTo(p(20.6f, 19.1f), p(20.2f, 16.8f), p(19.0f, 15.8f))
            cubicTo(p(18.0f, 15.0f), p(16.8f, 14.7f), p(15.4f, 14.7f))
            lineTo(p(6.6f, 14.7f))
            cubicTo(p(5.2f, 14.7f), p(4.0f, 15.0f), p(3.0f, 15.8f))
            close()
        }
        drawPath(body, tint)
        drawRoundRect(cut, topLeft = p(5.4f, 16.1f), size = androidx.compose.ui.geometry.Size(len(1f, 1f), len(1f, 3f)), cornerRadius = androidx.compose.ui.geometry.CornerRadius(len(1f, .3f)))
        drawRoundRect(cut, topLeft = p(4.4f, 17.1f), size = androidx.compose.ui.geometry.Size(len(1f, 3f), len(1f, 1f)), cornerRadius = androidx.compose.ui.geometry.CornerRadius(len(1f, .3f)))
        drawCircle(cut, radius = len(1f, .7f), center = p(14.6f, 16.6f))
        drawCircle(cut, radius = len(1f, .7f), center = p(16.6f, 17.8f))
    }
}

@Composable
fun SeriesIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        catFace(0f, -2.4f, 1f, tint, cut)
        fun p(x: Float, y: Float) = px(0f, 0f, 1f, x, y)
        drawRoundRect(
            tint,
            topLeft = p(2.2f, 10.6f),
            size = androidx.compose.ui.geometry.Size(len(1f, 17.6f), len(1f, 10.6f)),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(len(1f, 1.9f)),
        )
        val play = Path().apply { moveTo(p(9.2f, 13.6f)); lineTo(p(9.2f, 18f)); lineTo(p(13f, 15.8f)); close() }
        drawPath(play, cut)
    }
}

@Composable
fun MangasIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        catFace(-4f, 0f, 1f, tint, cut)
        val center = px(0f, 0f, 1f, 18.5f, 10.2f)
        drawContext.canvas.nativeCanvas.apply {
            val paint = Paint().apply {
                color = tint.toArgb()
                textSize = len(1f, 13.5f)
                textAlign = Paint.Align.CENTER
                isAntiAlias = true
            }
            val metrics = paint.fontMetrics
            val yOffset = (metrics.descent + metrics.ascent) / 2f
            drawText("猫", center.x, center.y - yOffset, paint)
        }
    }
}

@Composable
fun AtividadesIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        paw(0f, 0f, 1f, tint)
        fun p(x: Float, y: Float) = px(0f, 0f, 1f, x, y)
        val pulse = Path().apply {
            moveTo(p(7.4f, 16f))
            lineTo(p(9.3f, 16f))
            lineTo(p(10.3f, 13.4f))
            lineTo(p(11.6f, 18.6f))
            lineTo(p(12.6f, 16f))
            lineTo(p(14.6f, 16f))
        }
        drawPath(
            pulse,
            cut,
            style = Stroke(width = len(1f, 1.1f), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

@Composable
fun SocialIcon(tint: Color, cut: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        catFull(-3.4f, 1.6f, .66f, tint, cut)
        catFull(11.5f, 4.4f, .58f, tint, cut)
    }
}
