package xyz.cqn.cqntrack.games.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.games.data.GameListDetailDto
import xyz.cqn.cqntrack.games.data.GameListsRepository
import javax.inject.Inject

data class GameListDetailUiState(
    val isLoading: Boolean = true,
    val list: GameListDetailDto? = null,
    val errorMessage: String? = null,
    val isDeleted: Boolean = false,
)

@HiltViewModel
class GameListDetailViewModel @Inject constructor(
    private val gameListsRepository: GameListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val listId: String = checkNotNull(savedStateHandle["listId"])

    private val _uiState = MutableStateFlow(GameListDetailUiState())
    val uiState: StateFlow<GameListDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val list = gameListsRepository.getListDetail(listId)
                _uiState.update { it.copy(isLoading = false, list = list) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar lista.") }
            }
        }
    }

    fun removeItem(igdbId: Int) {
        viewModelScope.launch {
            try {
                gameListsRepository.removeItem(listId, igdbId)
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover item.") }
            }
        }
    }

    fun deleteList() {
        viewModelScope.launch {
            try {
                gameListsRepository.deleteList(listId)
                _uiState.update { it.copy(isDeleted = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao excluir lista.") }
            }
        }
    }
}
