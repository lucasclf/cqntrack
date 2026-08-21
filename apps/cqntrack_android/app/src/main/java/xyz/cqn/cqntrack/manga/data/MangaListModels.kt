package xyz.cqn.cqntrack.manga.data

import kotlinx.serialization.Serializable

/** Espelha MangaListSchema em packages/shared/src/manga.ts. */
@Serializable
data class MangaListDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class MangaListsResponseDto(
    val lists: List<MangaListDto>,
)

/** Espelha MangaListDetailSchema (MangaListSchema + items). */
@Serializable
data class MangaListDetailDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
    val items: List<MangaSummaryDto>,
)

@Serializable
data class CreateMangaListRequestDto(
    val name: String,
    val description: String? = null,
)

@Serializable
data class UpdateMangaListRequestDto(
    val name: String? = null,
    val description: String? = null,
)
