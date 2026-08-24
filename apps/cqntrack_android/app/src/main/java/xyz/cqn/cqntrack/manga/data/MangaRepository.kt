package xyz.cqn.cqntrack.manga.data

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import retrofit2.HttpException
import xyz.cqn.cqntrack.core.network.ApiException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MangaRepository @Inject constructor(
    private val mangaApi: MangaApi,
) {
    suspend fun search(query: String): List<MangaSummaryDto> =
        runApiCall { mangaApi.search(query).results }

    suspend fun getDetail(mangadexId: String): MangaDetailResponseDto =
        runApiCall { mangaApi.getDetail(mangadexId) }

    suspend fun discover(page: Int): DiscoverMangaResponseDto =
        runApiCall { mangaApi.discover(page) }

    suspend fun upsertEntry(mangadexId: String, body: UpsertMangaEntryRequestDto): MangaEntryDto =
        runApiCall { mangaApi.upsertEntry(mangadexId, body) }

    suspend fun setRating(mangadexId: String, rating: Double?): MangaEntryDto =
        runApiCall { mangaApi.upsertEntryRaw(mangadexId, buildJsonObject { put("rating", rating) }) }

    suspend fun setReview(mangadexId: String, review: String?): MangaEntryDto =
        runApiCall { mangaApi.upsertEntryRaw(mangadexId, buildJsonObject { put("review", review) }) }

    suspend fun deleteEntry(mangadexId: String) = runApiCall { mangaApi.deleteEntry(mangadexId) }

    suspend fun getVolumes(mangadexId: String): MangaVolumesResponseDto =
        runApiCall { mangaApi.getVolumes(mangadexId) }

    suspend fun setChapterRead(mangadexId: String, volumeNumber: Int, chapterNumber: Double, read: Boolean) =
        runApiCall { mangaApi.setChapterRead(mangadexId, volumeNumber, chapterNumber, SetChapterReadRequestDto(read)) }

    suspend fun setVolumeRead(mangadexId: String, volumeNumber: Int, read: Boolean) =
        runApiCall { mangaApi.setVolumeRead(mangadexId, volumeNumber, SetChapterReadRequestDto(read)) }

    suspend fun getEntries(
        status: MangaStatus?,
        favorite: Boolean?,
        sortBy: String,
        order: String,
        page: Int,
    ): PaginatedMangaEntriesResponseDto = runApiCall {
        mangaApi.getEntries(status?.toApiValue(), favorite, sortBy, order, page)
    }

    suspend fun getAuthor(authorId: String): AuthorMangaResponseDto = runApiCall { mangaApi.getAuthor(authorId) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}

private fun MangaStatus.toApiValue(): String = when (this) {
    MangaStatus.WantToRead -> "want_to_read"
    MangaStatus.Reading -> "reading"
    MangaStatus.Read -> "read"
    MangaStatus.Dropped -> "dropped"
}
