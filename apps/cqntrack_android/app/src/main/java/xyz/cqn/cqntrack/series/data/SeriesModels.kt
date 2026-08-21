package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.Serializable

/**
 * Espelha SeriesSummarySchema em packages/shared/src/series.ts. `seasons`
 * (lista de temporadas) fica de fora aqui de propósito — não usado nesta
 * primeira versão do app nativo (sem tela de episódios ainda, ver
 * chapters/episodes como próximo passo natural).
 */
@Serializable
data class SeriesSummaryDto(
    val tmdbId: Int,
    val name: String,
    val posterUrl: String? = null,
    val firstAirDate: String? = null,
    val genres: List<String>,
    val numberOfSeasons: Int? = null,
    val numberOfEpisodes: Int? = null,
    val rating: Double? = null,
)

/** Espelha SeriesDetailSchema (SeriesSummarySchema + overview; sem cast/creators/directors nesta versão). */
@Serializable
data class SeriesDetailDto(
    val tmdbId: Int,
    val name: String,
    val posterUrl: String? = null,
    val firstAirDate: String? = null,
    val genres: List<String>,
    val numberOfSeasons: Int? = null,
    val numberOfEpisodes: Int? = null,
    val rating: Double? = null,
    val overview: String? = null,
)

/**
 * Espelha SeriesEntrySchema. Sem `status` (série não tem — só progresso por
 * episódio, ver comentário no schema compartilhado). `availableEpisode`/
 * `upcomingEpisode` ficam de fora aqui: exigiriam a tela de episódios pra
 * fazer sentido, fora do escopo desta versão.
 */
@Serializable
data class SeriesEntryDto(
    val id: String,
    val rating: Double? = null,
    val watchedEpisodeCount: Int,
    val favoritedAt: String? = null,
    val abandonedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
)

@Serializable
data class SearchSeriesResponseDto(
    val results: List<SeriesSummaryDto>,
)

@Serializable
data class SeriesDetailResponseDto(
    val series: SeriesDetailDto,
    val entry: SeriesEntryDto? = null,
)

@Serializable
data class UpsertSeriesEntryRequestDto(
    val rating: Double? = null,
    val review: String? = null,
    val favorited: Boolean? = null,
    val abandoned: Boolean? = null,
)
