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
import xyz.cqn.cqntrack.games.data.CreateGameListRequestDto
import xyz.cqn.cqntrack.games.data.GameDetailDto
import xyz.cqn.cqntrack.games.data.GameEntryDto
import xyz.cqn.cqntrack.games.data.GameListDto
import xyz.cqn.cqntrack.games.data.GameListsRepository
import xyz.cqn.cqntrack.games.data.GameStatus
import xyz.cqn.cqntrack.games.data.GamesRepository
import xyz.cqn.cqntrack.games.data.UpsertGameEntryRequestDto
import javax.inject.Inject

data class GameDetailUiState(
    val isLoading: Boolean = true,
    val game: GameDetailDto? = null,
    val entry: GameEntryDto? = null,
    val errorMessage: String? = null,
    val showAddToListDialog: Boolean = false,
    val availableLists: List<GameListDto> = emptyList(),
    val addToListMessage: String? = null,
)

@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gamesRepository: GamesRepository,
    private val gameListsRepository: GameListsRepository,
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

    fun setRating(rating: Double?) {
        viewModelScope.launch {
            try {
                val updated = gamesRepository.setRating(igdbId, rating)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun setReview(review: String?) {
        viewModelScope.launch {
            try {
                val updated = gamesRepository.setReview(igdbId, review)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    /** Espelha togglePlatform em GameDetail.tsx (web) — lista vazia vira null (limpa o campo). */
    fun togglePlatform(platform: String) {
        val current = _uiState.value.entry?.platforms ?: emptyList()
        val next = if (platform in current) current - platform else current + platform
        viewModelScope.launch {
            try {
                val updated = gamesRepository.setPlatforms(igdbId, next.ifEmpty { null })
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun removeEntry() {
        viewModelScope.launch {
            try {
                gamesRepository.deleteEntry(igdbId)
                _uiState.update { it.copy(entry = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover marcação. Tente de novo.") }
            }
        }
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

    fun openAddToListDialog() {
        _uiState.update { it.copy(showAddToListDialog = true, addToListMessage = null) }
        viewModelScope.launch {
            try {
                val lists = gameListsRepository.getLists()
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
                gameListsRepository.addItem(listId, igdbId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao adicionar à lista.") }
            }
        }
    }

    fun createListAndAdd(name: String) {
        viewModelScope.launch {
            try {
                val list = gameListsRepository.createList(CreateGameListRequestDto(name))
                gameListsRepository.addItem(list.id, igdbId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao criar lista.") }
            }
        }
    }
}
