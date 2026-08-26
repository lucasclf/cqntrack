package xyz.cqn.cqntrack.social.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.activity.data.MediaType
import xyz.cqn.cqntrack.activity.data.toApiValue
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SocialRepository @Inject constructor(
    private val socialApi: SocialApi,
) {
    /** Idempotente (204 mesmo se já seguia) — ver followUser em social.service.ts no backend. */
    suspend fun follow(username: String) = runApiCall { socialApi.follow(username) }

    /** Idempotente (204 mesmo se já não seguia). */
    suspend fun unfollow(username: String) = runApiCall { socialApi.unfollow(username) }

    suspend fun getFollowStatus(username: String): Boolean =
        runApiCall { socialApi.getFollowStatus(username).following }

    suspend fun getFollowing(): List<FollowedUserDto> =
        runApiCall { socialApi.getFollowing().items }

    suspend fun getFeed(before: String?, mediaType: MediaType?): FriendActivityFeedResponseDto =
        runApiCall { socialApi.getFeed(before, mediaType?.toApiValue()) }

    suspend fun search(query: String?, page: Int, pageSize: Int = 20): PaginatedUsersResponseDto =
        runApiCall { socialApi.search(query?.ifBlank { null }, page, pageSize) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
