package xyz.cqn.cqntrack.core.designsystem

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material.icons.filled.StarHalf
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/**
 * Nota de 0 a 5 em passos de 0.5 — espelha StarRating.tsx (web). Cada
 * estrela tem metade esquerda/direita clicável (meia nota / nota cheia).
 * Tocar na nota já marcada remove a nota. `onChange == null` = somente
 * leitura (sem área de toque).
 */
@Composable
fun StarRating(
    value: Double?,
    onChange: ((Double?) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        for (starIndex in 1..5) {
            val filled = when {
                value == null -> 0.0
                value >= starIndex -> 1.0
                value >= starIndex - 0.5 -> 0.5
                else -> 0.0
            }
            val icon = when (filled) {
                1.0 -> Icons.Filled.Star
                0.5 -> Icons.Filled.StarHalf
                else -> Icons.Filled.StarBorder
            }
            Icon(
                imageVector = icon,
                contentDescription = if (onChange != null) "$starIndex estrelas" else null,
                tint = if (filled > 0.0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                modifier = Modifier
                    .size(28.dp)
                    .let { base ->
                        if (onChange == null) {
                            base
                        } else {
                            base.pointerInput(starIndex, value) {
                                detectTapGestures { offset ->
                                    val half = offset.x < size.width / 2
                                    val tapped = if (half) starIndex - 0.5 else starIndex.toDouble()
                                    onChange(if (tapped == value) null else tapped)
                                }
                            }
                        }
                    },
            )
        }
        if (value != null) {
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = formatRating(value), style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun formatRating(value: Double): String {
    val rounded = (value * 10).roundToInt() / 10.0
    return if (rounded == rounded.toLong().toDouble()) {
        "${rounded.toLong()}.0"
    } else {
        rounded.toString()
    }
}
