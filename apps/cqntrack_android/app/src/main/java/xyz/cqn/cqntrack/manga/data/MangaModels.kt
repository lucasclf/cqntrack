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

/** Espelha DiscoverMangaResponseSchema — populares reais via GET /api/manga/discover (GET .../order[followedCount]). */
@Serializable
data class DiscoverMangaResponseDto(
    val results: List<MangaSummaryDto>,
    val page: Int,
    val hasMore: Boolean,
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

/**
 * Espelha MangaChapterSchema — `chapterNumber` é Double (não Int): a
 * MangaDex aceita capítulo decimal (ex. "10.5", extra/bônus). `-1` é o
 * sentinela de "sem número de capítulo" (oneshot/doujinshi), ver
 * chapters.service.ts no backend.
 */
@Serializable
data class MangaChapterDto(
    val chapterNumber: Double,
    val mangadexChapterId: String,
    val read: Boolean,
)

/**
 * Espelha MangaVolumeSchema — `volumeNumber: 0` é o sentinela de "sem
 * volume" (a MangaDex agrupa capítulo avulso sob a chave "none").
 */
@Serializable
data class MangaVolumeDto(
    val volumeNumber: Int,
    val chapters: List<MangaChapterDto>,
)

/**
 * Espelha MangaVolumesResponseSchema — diferente de série (uma chamada por
 * temporada), a MangaDex devolve TODOS os volumes/capítulos numa chamada só
 * (GET .../volumes, que usa /aggregate por baixo), ver
 * apps/cqntrack_be/src/manga/chapters.service.ts.
 */
@Serializable
data class MangaVolumesResponseDto(
    val volumes: List<MangaVolumeDto>,
)

/** Corpo de PUT .../chapters/:volume/:chapter e PUT .../volumes/:volume — mesmo formato pros dois casos. */
@Serializable
data class SetChapterReadRequestDto(
    val read: Boolean,
)

/**
 * Espelha AuthorMangaResponseSchema. Diferente de livro (Google Books, sem ID
 * de autor de verdade): a MangaDex tem GET /author/:id de verdade, então o
 * nome já vem resolvido pela própria API em vez de ecoar o parâmetro da rota.
 */
@Serializable
data class AuthorMangaResponseDto(
    val id: String,
    val name: String,
    val manga: List<MangaSummaryDto>,
)
