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
import xyz.cqn.cqntrack.manga.data.MangaDetailDto
import xyz.cqn.cqntrack.manga.data.MangaEntryDto
import xyz.cqn.cqntrack.manga.data.MangaRepository
import xyz.cqn.cqntrack.manga.data.MangaStatus
import xyz.cqn.cqntrack.manga.data.UpsertMangaEntryRequestDto
import javax.inject.Inject

data class MangaDetailUiState(
    val isLoading: Boolean = true,
    val manga: MangaDetailDto? = null,
    val entry: MangaEntryDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class MangaDetailViewModel @Inject constructor(
    private val mangaRepository: MangaRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val mangadexId: String = checkNotNull(savedStateHandle["mangadexId"])

    private val _uiState = MutableStateFlow(MangaDetailUiState())
    val uiState: StateFlow<MangaDetailUiState> = _uiState.asStateFlow()

    init {
        load()
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

    fun setStatus(status: MangaStatus) = updateEntry(UpsertMangaEntryRequestDto(status = status))

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertMangaEntryRequestDto(favorited = !isFavorited))
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
}
