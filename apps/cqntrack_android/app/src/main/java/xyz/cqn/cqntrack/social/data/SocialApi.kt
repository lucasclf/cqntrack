package xyz.cqn.cqntrack.social.data

import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/social/social.routes.ts, montado em /api/social. */
interface SocialApi {
    @PUT("api/social/follow/{username}")
    suspend fun follow(@Path("username") username: String)

    @DELETE("api/social/follow/{username}")
    suspend fun unfollow(@Path("username") username: String)

    @GET("api/social/follow/{username}/status")
    suspend fun getFollowStatus(@Path("username") username: String): FollowStatusResponseDto

    @GET("api/social/following")
    suspend fun getFollowing(): FollowingResponseDto

    @GET("api/social/feed")
    suspend fun getFeed(
        @Query("before") before: String? = null,
        @Query("mediaType") mediaType: String? = null,
        @Query("limit") limit: Int = 20,
    ): FriendActivityFeedResponseDto

    @GET("api/social/search")
    suspend fun search(
        @Query("q") q: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 20,
    ): PaginatedUsersResponseDto
}
