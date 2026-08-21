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
import xyz.cqn.cqntrack.games.data.GameDetailDto
import xyz.cqn.cqntrack.games.data.GameEntryDto
import xyz.cqn.cqntrack.games.data.GameStatus
import xyz.cqn.cqntrack.games.data.GamesRepository
import xyz.cqn.cqntrack.games.data.UpsertGameEntryRequestDto
import javax.inject.Inject

data class GameDetailUiState(
    val isLoading: Boolean = true,
    val game: GameDetailDto? = null,
    val entry: GameEntryDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gamesRepository: GamesRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val igdbId: Int = checkNotNull(savedStateHandle.get<String>("igdbId")).toInt()

    private val _uiState = MutableStateFlow(GameDetailUiState())
    val uiState: StateFlow<GameDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = gamesRepository.getDetail(igdbId)
                _uiState.update {
                    it.copy(isLoading = false, game = response.game, entry = response.entry)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    fun setStatus(status: GameStatus) = updateEntry(UpsertGameEntryRequestDto(status = status))

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertGameEntryRequestDto(favorited = !isFavorited))
    }

    private fun updateEntry(body: UpsertGameEntryRequestDto) {
        viewModelScope.launch {
            try {
                val updated = gamesRepository.upsertEntry(igdbId, body)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }
}
