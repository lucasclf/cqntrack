package xyz.cqn.cqntrack.profile.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val profileApi: ProfileApi,
) {
    suspend fun getMe(): AuthUserDto = runApiCall { profileApi.getMe() }

    suspend fun getPublicProfile(username: String): PublicProfileDto =
        runApiCall { profileApi.getPublicProfile(username) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
