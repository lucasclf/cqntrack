package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.Serializable

/** Espelha SeriesSeasonSummarySchema — vem de graça no detalhe, sem chamada extra. */
@Serializable
data class SeriesSeasonSummaryDto(
    val seasonNumber: Int,
    val name: String,
    val episodeCount: Int,
    val airDate: String? = null,
    val posterUrl: String? = null,
)

/** Espelha SeriesSummarySchema em packages/shared/src/series.ts. */
@Serializable
data class SeriesSummaryDto(
    val tmdbId: Int,
    val name: String,
    val posterUrl: String? = null,
    val firstAirDate: String? = null,
    val genres: List<String>,
    val numberOfSeasons: Int? = null,
    val numberOfEpisodes: Int? = null,
    val seasons: List<SeriesSeasonSummaryDto>? = null,
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
    val seasons: List<SeriesSeasonSummaryDto>? = null,
    val rating: Double? = null,
    val overview: String? = null,
)

/**
 * Espelha SeriesEntrySchema. Sem `status` (série não tem — só progresso por
 * episódio, ver comentário no schema compartilhado). `availableEpisode`/
 * `upcomingEpisode` ficam de fora aqui — teriam que virar UI própria
 * ("continuar assistindo"), fora do escopo desta versão.
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
    val nextSeasonToWatch: Int? = null,
)

@Serializable
data class UpsertSeriesEntryRequestDto(
    val rating: Double? = null,
    val review: String? = null,
    val favorited: Boolean? = null,
    val abandoned: Boolean? = null,
)

/**
 * Espelha SeriesEpisodeSchema — buscado ao vivo na TMDB a cada abertura de
 * temporada (sem cache local, só `watched` é nosso), ver
 * apps/cqntrack_be/src/series/episodes.service.ts.
 */
@Serializable
data class SeriesEpisodeDto(
    val episodeNumber: Int,
    val name: String,
    val airDate: String? = null,
    val stillUrl: String? = null,
    val watched: Boolean,
)

@Serializable
data class SeriesSeasonEpisodesResponseDto(
    val seasonNumber: Int,
    val episodes: List<SeriesEpisodeDto>,
)

/** Corpo de PUT .../episodes/:season/:episode e PUT .../seasons/:season — mesmo formato pros dois casos. */
@Serializable
data class SetWatchedRequestDto(
    val watched: Boolean,
)
