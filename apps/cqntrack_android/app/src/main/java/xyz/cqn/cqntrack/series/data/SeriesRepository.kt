package xyz.cqn.cqntrack.series.data

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SeriesRepository @Inject constructor(
    private val seriesApi: SeriesApi,
) {
    suspend fun search(query: String): List<SeriesSummaryDto> =
        runApiCall { seriesApi.search(query).results }

    suspend fun getDetail(tmdbId: Int): SeriesDetailResponseDto =
        runApiCall { seriesApi.getDetail(tmdbId) }

    suspend fun discover(page: Int): DiscoverSeriesResponseDto =
        runApiCall { seriesApi.discover(page) }

    suspend fun upsertEntry(tmdbId: Int, body: UpsertSeriesEntryRequestDto): SeriesEntryDto =
        runApiCall { seriesApi.upsertEntry(tmdbId, body) }

    suspend fun setRating(tmdbId: Int, rating: Double?): SeriesEntryDto =
        runApiCall { seriesApi.upsertEntryRaw(tmdbId, buildJsonObject { put("rating", rating) }) }

    suspend fun setReview(tmdbId: Int, review: String?): SeriesEntryDto =
        runApiCall { seriesApi.upsertEntryRaw(tmdbId, buildJsonObject { put("review", review) }) }

    suspend fun deleteEntry(tmdbId: Int) = runApiCall { seriesApi.deleteEntry(tmdbId) }

    suspend fun getSeasonEpisodes(tmdbId: Int, seasonNumber: Int): SeriesSeasonEpisodesResponseDto =
        runApiCall { seriesApi.getSeasonEpisodes(tmdbId, seasonNumber) }

    suspend fun setEpisodeWatched(tmdbId: Int, seasonNumber: Int, episodeNumber: Int, watched: Boolean) =
        runApiCall { seriesApi.setEpisodeWatched(tmdbId, seasonNumber, episodeNumber, SetWatchedRequestDto(watched)) }

    suspend fun setSeasonWatched(tmdbId: Int, seasonNumber: Int, watched: Boolean) =
        runApiCall { seriesApi.setSeasonWatched(tmdbId, seasonNumber, SetWatchedRequestDto(watched)) }

    suspend fun getEntries(
        favorite: Boolean?,
        sortBy: String,
        order: String,
        page: Int,
    ): PaginatedSeriesEntriesResponseDto = runApiCall { seriesApi.getEntries(favorite, sortBy, order, page) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
