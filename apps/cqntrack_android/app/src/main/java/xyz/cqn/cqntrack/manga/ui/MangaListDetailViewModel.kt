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
import xyz.cqn.cqntrack.manga.data.MangaListDetailDto
import xyz.cqn.cqntrack.manga.data.MangaListsRepository
import javax.inject.Inject

data class MangaListDetailUiState(
    val isLoading: Boolean = true,
    val list: MangaListDetailDto? = null,
    val errorMessage: String? = null,
    val isDeleted: Boolean = false,
)

@HiltViewModel
class MangaListDetailViewModel @Inject constructor(
    private val mangaListsRepository: MangaListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val listId: String = checkNotNull(savedStateHandle["listId"])

    private val _uiState = MutableStateFlow(MangaListDetailUiState())
    val uiState: StateFlow<MangaListDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val list = mangaListsRepository.getListDetail(listId)
                _uiState.update { it.copy(isLoading = false, list = list) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar lista.") }
            }
        }
    }

    fun removeItem(mangadexId: String) {
        viewModelScope.launch {
            try {
                mangaListsRepository.removeItem(listId, mangadexId)
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover item.") }
            }
        }
    }

    fun deleteList() {
        viewModelScope.launch {
            try {
                mangaListsRepository.deleteList(listId)
                _uiState.update { it.copy(isDeleted = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao excluir lista.") }
            }
        }
    }
}
