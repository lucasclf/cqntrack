package xyz.cqn.cqntrack.profile.data

import okhttp3.MultipartBody
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.PUT

/** Espelha as rotas /api/me (app.ts) e /api/users/:username (users.routes.ts). */
interface ProfileApi {
    @GET("api/me")
    suspend fun getMe(): AuthUserDto

    @GET("api/users/{username}")
    suspend fun getPublicProfile(@Path("username") username: String): PublicProfileDto

    /**
     * Só sobe o arquivo pro Cloudinary (proxy assinado) — quem persiste a
     * URL em `user.image` é o app, via AuthRepository.updateImage (mesmo
     * mecanismo do better-auth já usado pro nome), ver comentário
     * equivalente em AvatarUpload.tsx no web.
     */
    @Multipart
    @PUT("api/me/avatar")
    suspend fun uploadAvatar(@Part file: MultipartBody.Part): UploadAvatarResponseDto
}
