package xyz.cqn.cqntrack.movies.data

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
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

    suspend fun discover(page: Int): DiscoverMoviesResponseDto =
        runApiCall { moviesApi.discover(page) }

    suspend fun upsertEntry(tmdbId: Int, body: UpsertMovieEntryRequestDto): MovieEntryDto =
        runApiCall { moviesApi.upsertEntry(tmdbId, body) }

    suspend fun setRating(tmdbId: Int, rating: Double?): MovieEntryDto =
        runApiCall { moviesApi.upsertEntryRaw(tmdbId, buildJsonObject { put("rating", rating) }) }

    suspend fun setReview(tmdbId: Int, review: String?): MovieEntryDto =
        runApiCall { moviesApi.upsertEntryRaw(tmdbId, buildJsonObject { put("review", review) }) }

    suspend fun deleteEntry(tmdbId: Int) = runApiCall { moviesApi.deleteEntry(tmdbId) }

    suspend fun getEntries(
        status: MovieStatus?,
        favorite: Boolean?,
        sortBy: String,
        order: String,
        page: Int,
    ): PaginatedMovieEntriesResponseDto = runApiCall {
        moviesApi.getEntries(status?.toApiValue(), favorite, sortBy, order, page)
    }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}

private fun MovieStatus.toApiValue(): String = when (this) {
    MovieStatus.WantToWatch -> "want_to_watch"
    MovieStatus.Watched -> "watched"
}
