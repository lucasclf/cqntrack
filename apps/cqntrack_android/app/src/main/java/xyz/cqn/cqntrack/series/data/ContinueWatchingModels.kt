package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.Serializable

/** Espelha ContinueWatchingItem["nextEpisode"] em packages/shared/src/series.ts. */
@Serializable
data class ContinueWatchingNextEpisodeDto(
    val seasonNumber: Int,
    val episodeNumber: Int,
    val name: String,
    val airDate: String,
)

/**
 * Espelha ContinueWatchingItemSchema — calculado ao vivo pelo backend
 * (GET /api/series/continue-watching), sem tabela pré-computada. `series` é o
 * mesmo shape de SeriesSummaryDto (reaproveitado, sem DTO novo).
 */
@Serializable
data class ContinueWatchingItemDto(
    val series: SeriesSummaryDto,
    val nextEpisode: ContinueWatchingNextEpisodeDto,
    val recentlyActive: Boolean,
)

/** `nextCursor` aqui é o índice (não datetime) na lista ordenada — ver continue-watching.service.ts no backend. */
@Serializable
data class ContinueWatchingResponseDto(
    val items: List<ContinueWatchingItemDto>,
    val nextCursor: Int? = null,
)

/**
 * Espelha ContinueWatchingItemResponseSchema — resposta de GET .../{tmdbId}/continue-watching,
 * usada pra recalcular só 1 linha da lista depois de marcar um episódio como assistido (ver
 * ContinueWatchingViewModel.markEpisodeWatched). `item: null` = a série não tem mais episódio
 * pendente, some da lista.
 */
@Serializable
data class ContinueWatchingItemResponseDto(
    val item: ContinueWatchingItemDto? = null,
)
