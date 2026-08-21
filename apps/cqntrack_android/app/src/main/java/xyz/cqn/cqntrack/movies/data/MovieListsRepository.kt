package xyz.cqn.cqntrack.movies.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MovieListsRepository @Inject constructor(
    private val movieListsApi: MovieListsApi,
) {
    suspend fun getLists(): List<MovieListDto> = runApiCall { movieListsApi.getLists().lists }

    suspend fun createList(body: CreateMovieListRequestDto): MovieListDto =
        runApiCall { movieListsApi.createList(body) }

    suspend fun getListDetail(listId: String): MovieListDetailDto =
        runApiCall { movieListsApi.getListDetail(listId) }

    suspend fun updateList(listId: String, body: UpdateMovieListRequestDto): MovieListDto =
        runApiCall { movieListsApi.updateList(listId, body) }

    suspend fun deleteList(listId: String) = runApiCall { movieListsApi.deleteList(listId) }

    suspend fun addItem(listId: String, tmdbId: Int) = runApiCall { movieListsApi.addItem(listId, tmdbId) }

    suspend fun removeItem(listId: String, tmdbId: Int) = runApiCall { movieListsApi.removeItem(listId, tmdbId) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
