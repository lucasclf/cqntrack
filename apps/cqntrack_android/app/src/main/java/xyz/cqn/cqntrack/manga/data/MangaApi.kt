package xyz.cqn.cqntrack.manga.data

import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

/** Espelha apps/cqntrack_be/src/manga/manga.routes.ts, montado em /api/manga. */
interface MangaApi {
    @GET("api/manga/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchMangaResponseDto

    @GET("api/manga/discover")
    suspend fun discover(@Query("page") page: Int = 1): DiscoverMangaResponseDto

    @GET("api/manga/{mangadexId}")
    suspend fun getDetail(@Path("mangadexId") mangadexId: String): MangaDetailResponseDto

    @PUT("api/manga/{mangadexId}/entry")
    suspend fun upsertEntry(
        @Path("mangadexId") mangadexId: String,
        @Body body: UpsertMangaEntryRequestDto,
    ): MangaEntryDto

    /** Ver comentário equivalente em BooksApi.kt — corpo cru pra permitir limpar nota/review com null explícito. */
    @PUT("api/manga/{mangadexId}/entry")
    suspend fun upsertEntryRaw(@Path("mangadexId") mangadexId: String, @Body body: JsonObject): MangaEntryDto

    @DELETE("api/manga/{mangadexId}/entry")
    suspend fun deleteEntry(@Path("mangadexId") mangadexId: String)

    @GET("api/manga/{mangadexId}/volumes")
    suspend fun getVolumes(@Path("mangadexId") mangadexId: String): MangaVolumesResponseDto

    @PUT("api/manga/{mangadexId}/chapters/{volumeNumber}/{chapterNumber}")
    suspend fun setChapterRead(
        @Path("mangadexId") mangadexId: String,
        @Path("volumeNumber") volumeNumber: Int,
        @Path("chapterNumber") chapterNumber: Double,
        @Body body: SetChapterReadRequestDto,
    )

    @PUT("api/manga/{mangadexId}/volumes/{volumeNumber}")
    suspend fun setVolumeRead(
        @Path("mangadexId") mangadexId: String,
        @Path("volumeNumber") volumeNumber: Int,
        @Body body: SetChapterReadRequestDto,
    )

    /** Espelha ListMangaEntriesQuerySchema — "Minhas marcações". */
    @GET("api/manga/entries")
    suspend fun getEntries(
        @Query("status") status: String? = null,
        @Query("favorite") favorite: Boolean? = null,
        @Query("sortBy") sortBy: String = "updatedAt",
        @Query("order") order: String = "desc",
        @Query("page") page: Int = 1,
    ): PaginatedMangaEntriesResponseDto
}
