package xyz.cqn.cqntrack.people.data

import retrofit2.http.GET
import retrofit2.http.Path

/** Espelha apps/cqntrack_be/src/people/people.routes.ts, montado em /api/people. Rota autenticada (requireSession). */
interface PeopleApi {
    @GET("api/people/{personId}")
    suspend fun getPersonDetail(@Path("personId") personId: Int): PersonCreditsResponseDto
}
