package xyz.cqn.cqntrack.series.data

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

    suspend fun upsertEntry(tmdbId: Int, body: UpsertSeriesEntryRequestDto): SeriesEntryDto =
        runApiCall { seriesApi.upsertEntry(tmdbId, body) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
