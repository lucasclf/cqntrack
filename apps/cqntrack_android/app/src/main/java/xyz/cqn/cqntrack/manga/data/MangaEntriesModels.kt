package xyz.cqn.cqntrack.manga.data

import kotlinx.serialization.Serializable

/** Espelha MangaEntryWithMangaSchema (MangaEntrySchema + manga) — usado na listagem "Minhas marcações". */
@Serializable
data class MangaEntryWithMangaDto(
    val id: String,
    val status: MangaStatus? = null,
    val rating: Double? = null,
    val readChapterCount: Int,
    val favoritedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
    val manga: MangaSummaryDto,
)

@Serializable
data class PaginatedMangaEntriesResponseDto(
    val items: List<MangaEntryWithMangaDto>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)
