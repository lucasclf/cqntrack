package xyz.cqn.cqntrack.activity.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActivityRepository @Inject constructor(
    private val activityApi: ActivityApi,
) {
    suspend fun getActivity(before: String?, mediaType: MediaType?): ActivityFeedResponseDto =
        runApiCall { activityApi.getActivity(before, mediaType?.toApiValue()) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}

/** Mesmo espírito de GameStatus.toApiValue()/etc. — o valor cru que a query string espera. */
fun MediaType.toApiValue(): String = when (this) {
    MediaType.Games -> "games"
    MediaType.Series -> "series"
    MediaType.Movies -> "movies"
    MediaType.Books -> "books"
    MediaType.Manga -> "manga"
}
