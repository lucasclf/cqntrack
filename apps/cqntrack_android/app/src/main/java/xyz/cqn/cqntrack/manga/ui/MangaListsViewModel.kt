package xyz.cqn.cqntrack.manga.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.manga.data.CreateMangaListRequestDto
import xyz.cqn.cqntrack.manga.data.MangaListDto
import xyz.cqn.cqntrack.manga.data.MangaListsRepository
import javax.inject.Inject

data class MangaListsUiState(
    val isLoading: Boolean = true,
    val lists: List<MangaListDto> = emptyList(),
    val errorMessage: String? = null,
    val isCreating: Boolean = false,
)

@HiltViewModel
class MangaListsViewModel @Inject constructor(
    private val mangaListsRepository: MangaListsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MangaListsUiState())
    val uiState: StateFlow<MangaListsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val lists = mangaListsRepository.getLists()
                _uiState.update { it.copy(isLoading = false, lists = lists) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar listas.") }
            }
        }
    }

    fun createList(name: String, description: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCreating = true, errorMessage = null) }
            try {
                mangaListsRepository.createList(CreateMangaListRequestDto(name, description?.ifBlank { null }))
                _uiState.update { it.copy(isCreating = false) }
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(isCreating = false, errorMessage = "Falha ao criar lista.") }
            }
        }
    }
}
