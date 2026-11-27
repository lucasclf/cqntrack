package xyz.cqn.cqntrack.activity

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import xyz.cqn.cqntrack.activity.data.ActivityItemDto
import xyz.cqn.cqntrack.activity.data.MediaType

class DescribeActivityTest {

    private fun statusChanged(mediaType: MediaType, status: String) = ActivityItemDto(
        id = "1",
        mediaType = mediaType,
        itemId = "x",
        itemTitle = "Item",
        itemHref = "/x",
        type = "status_changed",
        metadata = buildJsonObject { put("status", status) },
        createdAt = "2026-01-01T10:00:00.000Z",
    )

    @Test
    fun `status de manga usa o rotulo de manga`() {
        assertEquals("Marcou como \"Lendo\"", describeActivity(statusChanged(MediaType.Manga, "reading")))
        assertEquals("Marcou como \"Lido\"", describeActivity(statusChanged(MediaType.Manga, "read")))
    }

    @Test
    fun `cada secao usa o proprio mapa de rotulos`() {
        assertEquals("Marcou como \"Jogando\"", describeActivity(statusChanged(MediaType.Games, "playing")))
        assertEquals("Marcou como \"Lendo\"", describeActivity(statusChanged(MediaType.Books, "reading")))
        assertEquals("Marcou como \"Já vi\"", describeActivity(statusChanged(MediaType.Movies, "watched")))
    }

    @Test
    fun `status sem rotulo conhecido vira texto generico`() {
        assertEquals("Mudou o status", describeActivity(statusChanged(MediaType.Games, "status_inexistente")))
    }
}
