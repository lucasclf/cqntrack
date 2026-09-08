package xyz.cqn.cqntrack.update.data

import retrofit2.http.GET

/** API pública do GitHub, não a do backend cqntrack — sem autenticação, host próprio (ver UpdateModule). */
interface UpdateApi {
    @GET("repos/lucasclf/cqntrack/releases/latest")
    suspend fun getLatestRelease(): GithubReleaseDto
}
