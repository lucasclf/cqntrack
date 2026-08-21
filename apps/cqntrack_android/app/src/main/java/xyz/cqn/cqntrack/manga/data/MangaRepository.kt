package xyz.cqn.cqntrack.manga.data

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

    suspend fun getVolumes(mangadexId: String): MangaVolumesResponseDto =
        runApiCall { mangaApi.getVolumes(mangadexId) }

    suspend fun setChapterRead(mangadexId: String, volumeNumber: Int, chapterNumber: Double, read: Boolean) =
        runApiCall { mangaApi.setChapterRead(mangadexId, volumeNumber, chapterNumber, SetChapterReadRequestDto(read)) }

    suspend fun setVolumeRead(mangadexId: String, volumeNumber: Int, read: Boolean) =
        runApiCall { mangaApi.setVolumeRead(mangadexId, volumeNumber, SetChapterReadRequestDto(read)) }

    private suspend fun <T> runApiCall(block: suspend () -> T): T =
        try {
            block()
        } catch (e: HttpException) {
            throw ApiException(e.code(), "Falha na requisição (status ${e.code()})")
        }
}
