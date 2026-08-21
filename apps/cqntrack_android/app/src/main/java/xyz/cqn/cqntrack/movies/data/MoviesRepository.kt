package xyz.cqn.cqntrack.movies.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MoviesRepository @Inject constructor(
    private val moviesApi: MoviesApi,
) {
    suspend fun search(query: String): List<MovieSummaryDto> =
        runApiCall { moviesApi.search(query).results }

    suspend fun getDetail(tmdbId: Int): MovieDetailResponseDto =
        runApiCall { moviesApi.getDetail(tmdbId) }

    suspend fun upsertEntry(tmdbId: Int, body: UpsertMovieEntryRequestDto): MovieEntryDto =
        runApiCall { moviesApi.upsertEntry(tmdbId, body) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
