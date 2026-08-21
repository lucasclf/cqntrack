package xyz.cqn.cqntrack.manga.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Espelha MangaAuthorRefSchema — MangaDex tem ID de autor de verdade, diferente de livro (Google Books). */
@Serializable
data class MangaAuthorRefDto(
    val id: String,
    val name: String,
)

/** Espelha MangaSummarySchema em packages/shared/src/manga.ts. */
@Serializable
data class MangaSummaryDto(
    val mangadexId: String,
    val title: String,
    val coverUrl: String? = null,
    val authors: List<MangaAuthorRefDto>,
    val tags: List<String>,
    val publicationStatus: String? = null,
    val year: Int? = null,
)

/** Espelha MangaDetailSchema (MangaSummarySchema + description). */
@Serializable
data class MangaDetailDto(
    val mangadexId: String,
    val title: String,
    val coverUrl: String? = null,
    val authors: List<MangaAuthorRefDto>,
    val tags: List<String>,
    val publicationStatus: String? = null,
    val year: Int? = null,
    val description: String? = null,
)

/** Espelha MANGA_STATUSES em packages/shared/src/manga.ts (fonte única de verdade lá). */
@Serializable
enum class MangaStatus {
    @SerialName("want_to_read") WantToRead,
    @SerialName("reading") Reading,
    @SerialName("read") Read,
    @SerialName("dropped") Dropped,
}

/**
 * Espelha MangaEntrySchema. `readChapterCount` é só leitura aqui (progresso
 * granular por capítulo fica de fora desta versão — ver MangaVolumeList.tsx
 * no web pro que falta replicar).
 */
@Serializable
data class MangaEntryDto(
    val id: String,
    val status: MangaStatus? = null,
    val rating: Double? = null,
    val readChapterCount: Int,
    val favoritedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
)

@Serializable
data class SearchMangaResponseDto(
    val results: List<MangaSummaryDto>,
)

@Serializable
data class MangaDetailResponseDto(
    val manga: MangaDetailDto,
    val entry: MangaEntryDto? = null,
)

@Serializable
data class UpsertMangaEntryRequestDto(
    val status: MangaStatus? = null,
    val rating: Double? = null,
    val review: String? = null,
    val favorited: Boolean? = null,
)
