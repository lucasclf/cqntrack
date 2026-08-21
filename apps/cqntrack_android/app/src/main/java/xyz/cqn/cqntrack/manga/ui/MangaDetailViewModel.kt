package xyz.cqn.cqntrack.manga.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.manga.data.CreateMangaListRequestDto
import xyz.cqn.cqntrack.manga.data.MangaDetailDto
import xyz.cqn.cqntrack.manga.data.MangaEntryDto
import xyz.cqn.cqntrack.manga.data.MangaListDto
import xyz.cqn.cqntrack.manga.data.MangaListsRepository
import xyz.cqn.cqntrack.manga.data.MangaRepository
import xyz.cqn.cqntrack.manga.data.MangaStatus
import xyz.cqn.cqntrack.manga.data.MangaVolumeDto
import xyz.cqn.cqntrack.manga.data.UpsertMangaEntryRequestDto
import javax.inject.Inject

data class MangaDetailUiState(
    val isLoading: Boolean = true,
    val manga: MangaDetailDto? = null,
    val entry: MangaEntryDto? = null,
    val errorMessage: String? = null,
    val volumes: List<MangaVolumeDto> = emptyList(),
    val volumesLoading: Boolean = true,
    val selectedVolume: Int? = null,
    val volumeActionPending: Boolean = false,
    val showAddToListDialog: Boolean = false,
    val availableLists: List<MangaListDto> = emptyList(),
    val addToListMessage: String? = null,
)

@HiltViewModel
class MangaDetailViewModel @Inject constructor(
    private val mangaRepository: MangaRepository,
    private val mangaListsRepository: MangaListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val mangadexId: String = checkNotNull(savedStateHandle["mangadexId"])

    private val _uiState = MutableStateFlow(MangaDetailUiState())
    val uiState: StateFlow<MangaDetailUiState> = _uiState.asStateFlow()

    init {
        load()
        loadVolumes()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = mangaRepository.getDetail(mangadexId)
                _uiState.update {
                    it.copy(isLoading = false, manga = response.manga, entry = response.entry)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    /** MangaDex devolve TODOS os volumes/capítulos numa chamada só — sem cache local, sempre fresca. */
    private fun loadVolumes() {
        viewModelScope.launch {
            _uiState.update { it.copy(volumesLoading = true) }
            try {
                val response = mangaRepository.getVolumes(mangadexId)
                _uiState.update {
                    it.copy(
                        volumesLoading = false,
                        volumes = response.volumes,
                        selectedVolume = it.selectedVolume ?: response.volumes.firstOrNull()?.volumeNumber,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(volumesLoading = false, errorMessage = "Falha ao carregar capítulos.")
                }
            }
        }
    }

    fun selectVolume(volumeNumber: Int) {
        _uiState.update { it.copy(selectedVolume = volumeNumber) }
    }

    fun setStatus(status: MangaStatus) = updateEntry(UpsertMangaEntryRequestDto(status = status))

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertMangaEntryRequestDto(favorited = !isFavorited))
    }

    /** Otimista: atualiza a UI antes da resposta, reverte se a chamada falhar. */
    fun toggleChapter(volumeNumber: Int, chapterNumber: Double, read: Boolean) {
        setChapterLocally(volumeNumber, chapterNumber, read)
        viewModelScope.launch {
            try {
                mangaRepository.setChapterRead(mangadexId, volumeNumber, chapterNumber, read)
                // Mesma armadilha de bumpWatchedCount em SeriesDetailViewModel: na primeira
                // marcação, `entry` ainda é null no cliente (só passa a existir depois que o
                // backend cria via ensureMangaEntry) — sem isso o contador de capítulos lidos
                // ficava travado em 0 até reabrir a tela (achado testando contra dado real).
                if (_uiState.value.entry == null) refreshEntry() else bumpReadCount(if (read) 1 else -1)
            } catch (e: Exception) {
                setChapterLocally(volumeNumber, chapterNumber, !read)
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun toggleVolume() {
        val volumeNumber = _uiState.value.selectedVolume ?: return
        val volume = _uiState.value.volumes.find { it.volumeNumber == volumeNumber } ?: return
        val allRead = volume.chapters.isNotEmpty() && volume.chapters.all { it.read }
        val nextRead = !allRead

        _uiState.update { it.copy(volumeActionPending = true) }
        viewModelScope.launch {
            try {
                mangaRepository.setVolumeRead(mangadexId, volumeNumber, nextRead)
                _uiState.update { state ->
                    state.copy(
                        volumeActionPending = false,
                        volumes = state.volumes.map { v ->
                            if (v.volumeNumber != volumeNumber) v
                            else v.copy(chapters = v.chapters.map { it.copy(read = nextRead) })
                        },
                    )
                }
                load()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(volumeActionPending = false, errorMessage = "Falha ao salvar. Tente de novo.")
                }
            }
        }
    }

    private fun setChapterLocally(volumeNumber: Int, chapterNumber: Double, read: Boolean) {
        _uiState.update { state ->
            state.copy(
                volumes = state.volumes.map { volume ->
                    if (volume.volumeNumber != volumeNumber) volume
                    else volume.copy(
                        chapters = volume.chapters.map {
                            if (it.chapterNumber == chapterNumber) it.copy(read = read) else it
                        },
                    )
                },
            )
        }
    }

    private fun bumpReadCount(delta: Int) {
        _uiState.update { state ->
            val entry = state.entry ?: return@update state
            state.copy(entry = entry.copy(readChapterCount = entry.readChapterCount + delta))
        }
    }

    private suspend fun refreshEntry() {
        try {
            val response = mangaRepository.getDetail(mangadexId)
            _uiState.update { it.copy(entry = response.entry) }
        } catch (e: Exception) {
            // Progresso já foi salvo no servidor (a chamada que disparou isto teve sucesso) —
            // só o contador na tela que fica desatualizado até a próxima abertura da tela.
        }
    }

    private fun updateEntry(body: UpsertMangaEntryRequestDto) {
        viewModelScope.launch {
            try {
                val updated = mangaRepository.upsertEntry(mangadexId, body)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun openAddToListDialog() {
        _uiState.update { it.copy(showAddToListDialog = true, addToListMessage = null) }
        viewModelScope.launch {
            try {
                val lists = mangaListsRepository.getLists()
                _uiState.update { it.copy(availableLists = lists) }
            } catch (e: Exception) {
                // Diálogo ainda funciona pra criar lista nova mesmo se isso falhar.
            }
        }
    }

    fun closeAddToListDialog() = _uiState.update { it.copy(showAddToListDialog = false) }

    fun addToList(listId: String) {
        viewModelScope.launch {
            try {
                mangaListsRepository.addItem(listId, mangadexId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao adicionar à lista.") }
            }
        }
    }

    fun createListAndAdd(name: String) {
        viewModelScope.launch {
            try {
                val list = mangaListsRepository.createList(CreateMangaListRequestDto(name))
                mangaListsRepository.addItem(list.id, mangadexId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao criar lista.") }
            }
        }
    }
}
