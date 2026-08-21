package xyz.cqn.cqntrack.manga.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/manga/manga.routes.ts, montado em /api/manga. */
interface MangaApi {
    @GET("api/manga/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchMangaResponseDto

    @GET("api/manga/{mangadexId}")
    suspend fun getDetail(@Path("mangadexId") mangadexId: String): MangaDetailResponseDto

    @PUT("api/manga/{mangadexId}/entry")
    suspend fun upsertEntry(
        @Path("mangadexId") mangadexId: String,
        @Body body: UpsertMangaEntryRequestDto,
    ): MangaEntryDto
}
