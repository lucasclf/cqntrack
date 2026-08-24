package xyz.cqn.cqntrack.people.data

import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PeopleRepository @Inject constructor(
    private val peopleApi: PeopleApi,
) {
    suspend fun getPersonDetail(personId: Int): PersonCreditsResponseDto =
        try {
            peopleApi.getPersonDetail(personId)
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
