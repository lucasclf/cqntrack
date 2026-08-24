package xyz.cqn.cqntrack.core.auth

import kotlinx.serialization.json.JsonObject
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * `Response<ResponseBody>` (não um DTO tipado) de propósito: o corpo de
 * sign-in/sign-up traz `user`/`session`, que este app não usa — o que
 * importa é o header `set-auth-token` da resposta (ver AuthRepository), e
 * `ResponseBody` deixa ler os headers sem forçar o converter JSON a
 * decodificar um corpo que não nos interessa.
 */
interface AuthApi {
    @POST("api/auth/sign-in/email")
    suspend fun signIn(@Body body: SignInRequest): Response<ResponseBody>

    @POST("api/auth/sign-up/email")
    suspend fun signUp(@Body body: SignUpRequest): Response<ResponseBody>

    @POST("api/auth/sign-out")
    suspend fun signOut(): Response<ResponseBody>

    /** Corpo cru (better-auth aceita qualquer campo do usuário) — este app só manda `name`. */
    @POST("api/auth/update-user")
    suspend fun updateUser(@Body body: JsonObject): Response<ResponseBody>

    @POST("api/auth/change-password")
    suspend fun changePassword(@Body body: ChangePasswordRequestDto): Response<ResponseBody>

    /** Corpo nulável: a rota devolve `null` quando não há sessão (ver contrato em session.mjs do better-auth). */
    @GET("api/auth/get-session")
    suspend fun getSession(): SessionResponseDto?
}
