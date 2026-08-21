package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.Serializable

/** Espelha SeriesEntryWithSeriesSchema (SeriesEntrySchema + series) — usado na listagem "Minhas marcações". */
@Serializable
data class SeriesEntryWithSeriesDto(
    val id: String,
    val rating: Double? = null,
    val watchedEpisodeCount: Int,
    val favoritedAt: String? = null,
    val abandonedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
    val series: SeriesSummaryDto,
)

@Serializable
data class PaginatedSeriesEntriesResponseDto(
    val items: List<SeriesEntryWithSeriesDto>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)
