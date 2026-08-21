package xyz.cqn.cqntrack.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.games.data.CreateGameListRequestDto
import xyz.cqn.cqntrack.games.data.GameListDto
import xyz.cqn.cqntrack.games.data.GameListsRepository
import javax.inject.Inject

data class GameListsUiState(
    val isLoading: Boolean = true,
    val lists: List<GameListDto> = emptyList(),
    val errorMessage: String? = null,
    val isCreating: Boolean = false,
)

@HiltViewModel
class GameListsViewModel @Inject constructor(
    private val gameListsRepository: GameListsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(GameListsUiState())
    val uiState: StateFlow<GameListsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val lists = gameListsRepository.getLists()
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
                gameListsRepository.createList(CreateGameListRequestDto(name, description?.ifBlank { null }))
                _uiState.update { it.copy(isCreating = false) }
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(isCreating = false, errorMessage = "Falha ao criar lista.") }
            }
        }
    }
}
