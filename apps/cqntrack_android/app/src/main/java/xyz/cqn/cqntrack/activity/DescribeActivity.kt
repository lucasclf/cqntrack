package xyz.cqn.cqntrack.activity

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import xyz.cqn.cqntrack.activity.data.ActivityItemDto
import xyz.cqn.cqntrack.activity.data.MediaType
import xyz.cqn.cqntrack.social.data.FriendActivityItemDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private val BOOK_STATUS_LABELS = mapOf(
    "want_to_read" to "Quero ler",
    "reading" to "Lendo",
    "read" to "Lido",
    "dropped" to "Abandonado",
)
private val MOVIE_STATUS_LABELS = mapOf(
    "want_to_watch" to "Quero ver",
    "watched" to "Já vi",
)
private val GAME_STATUS_LABELS = mapOf(
    "not_started" to "Quero jogar",
    "playing" to "Jogando",
    "dropped" to "Abandonado",
    "completed" to "Finalizado",
    "platinum" to "Platinado",
)

/**
 * Porta de apps/cqntrack_fe/src/activity/describeActivity.ts — mesmo vocabulário de `type`/
 * `metadata` entre seções (ver activity.schema.ts no backend), replicado aqui bug-a-bug (inclusive
 * o `else` de "status_changed" caindo em GAME_STATUS_LABELS pra qualquer seção que não seja
 * books/movies, igual ao original) pra manter os dois clientes narrando a mesma atividade do
 * mesmo jeito. Reaproveitado tanto pela aba Atividades quanto pelo feed de amigos da Social.
 */
fun describeActivity(item: ActivityItemDto): String =
    describeActivity(type = item.type, metadata = item.metadata, mediaType = item.mediaType)

/** Mesma função, pro item do feed de amigos (FriendActivityItemDto) — ver comentário acima. */
fun describeActivity(item: FriendActivityItemDto): String =
    describeActivity(type = item.type, metadata = item.metadata, mediaType = item.mediaType)

private fun describeActivity(type: String, metadata: JsonObject?, mediaType: MediaType): String {
    fun stringField(key: String): String? = metadata?.get(key)?.let { (it as? JsonPrimitive)?.content }
    fun doubleField(key: String): Double? = metadata?.get(key)?.let { (it as? JsonPrimitive)?.doubleOrNull }
    fun intField(key: String): Int? = metadata?.get(key)?.let { (it as? JsonPrimitive)?.intOrNull }

    return when (type) {
        "status_changed" -> {
            val status = stringField("status")
            val label = when (mediaType) {
                MediaType.Books -> status?.let { BOOK_STATUS_LABELS[it] }
                MediaType.Movies -> status?.let { MOVIE_STATUS_LABELS[it] }
                else -> status?.let { GAME_STATUS_LABELS[it] }
            }
            if (label != null) "Marcou como \"$label\"" else "Mudou o status"
        }
        "favorited" -> "Favoritou"
        "rated" -> {
            val rating = doubleField("rating")
            if (rating != null) "Avaliou com ${"%.1f".format(rating)} estrelas" else "Avaliou"
        }
        "reviewed" -> "Escreveu uma review"
        "added_to_list" -> {
            val listName = stringField("listName")
            if (listName != null) "Adicionou à lista \"$listName\"" else "Adicionou a uma lista"
        }
        "season_watched" -> {
            val season = intField("season")
            val episodeCount = intField("episodeCount")
            if (season != null) {
                "Assistiu a temporada $season" + if (episodeCount != null) " ($episodeCount episódios)" else ""
            } else {
                "Assistiu uma temporada inteira"
            }
        }
        "watched" -> "Assistiu"
        "series_completed" -> {
            val seasonCount = intField("seasonCount")
            if (seasonCount != null) {
                "Assistiu a série inteira ($seasonCount temporada${if (seasonCount == 1) "" else "s"})"
            } else {
                "Assistiu a série inteira"
            }
        }
        "manga_completed" -> "Leu o mangá inteiro"
        "imported" -> {
            val source = stringField("source")
            val label = when (source) {
                "filmow" -> "Filmow"
                "tvtime" -> "tvtime"
                else -> "importação"
            }
            "Importou do $label"
        }
        else -> "Atividade"
    }
}

private val ACTIVITY_DATE_FORMAT = SimpleDateFormat("dd/MM HH:mm", Locale("pt", "BR"))
private val ISO_FORMATS = listOf(
    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
    "yyyy-MM-dd'T'HH:mm:ss'Z'",
).map { pattern -> SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") } }

/** `createdAt` chega em UTC (z.iso.datetime() no backend) — converte pro fuso local do device. */
fun formatActivityDate(iso: String): String {
    val date = ISO_FORMATS.firstNotNullOfOrNull { format -> runCatching { format.parse(iso) }.getOrNull() }
        ?: return iso
    return ACTIVITY_DATE_FORMAT.format(date)
}
