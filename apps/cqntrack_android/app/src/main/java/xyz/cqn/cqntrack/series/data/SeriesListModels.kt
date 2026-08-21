package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.Serializable

/** Espelha SeriesListSchema em packages/shared/src/series.ts. */
@Serializable
data class SeriesListDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class SeriesListsResponseDto(
    val lists: List<SeriesListDto>,
)

/** Espelha SeriesListDetailSchema (SeriesListSchema + items). */
@Serializable
data class SeriesListDetailDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
    val items: List<SeriesSummaryDto>,
)

@Serializable
data class CreateSeriesListRequestDto(
    val name: String,
    val description: String? = null,
)

@Serializable
data class UpdateSeriesListRequestDto(
    val name: String? = null,
    val description: String? = null,
)
