package xyz.cqn.cqntrack.profile.data

import retrofit2.http.GET
import retrofit2.http.Path

/** Espelha as rotas /api/me (app.ts) e /api/users/:username (users.routes.ts). */
interface ProfileApi {
    @GET("api/me")
    suspend fun getMe(): AuthUserDto

    @GET("api/users/{username}")
    suspend fun getPublicProfile(@Path("username") username: String): PublicProfileDto
}
