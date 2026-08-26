package xyz.cqn.cqntrack.activity.data

import retrofit2.http.GET
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/activity/activity.routes.ts, montado em /api/activity. */
interface ActivityApi {
    @GET("api/activity")
    suspend fun getActivity(
        @Query("before") before: String? = null,
        @Query("mediaType") mediaType: String? = null,
        @Query("limit") limit: Int = 20,
    ): ActivityFeedResponseDto
}
