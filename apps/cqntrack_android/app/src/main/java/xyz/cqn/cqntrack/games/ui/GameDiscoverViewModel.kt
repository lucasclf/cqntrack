package xyz.cqn.cqntrack.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.games.data.GameSummaryDto
import xyz.cqn.cqntrack.games.data.GamesRepository
import javax.inject.Inject

data class GameDiscoverUiState(
    val isLoading: Boolean = true,
    val results: List<GameSummaryDto> = emptyList(),
    val page: Int = 1,
    val hasMore: Boolean = false,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
)

/** Aclamados reais da própria IGDB (GET /api/games/discover, ordenado por total_rating com piso de avaliações). */
@HiltViewModel
class GameDiscoverViewModel @Inject constructor(
    private val gamesRepository: GamesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(GameDiscoverUiState())
    val uiState: StateFlow<GameDiscoverUiState> = _uiState.asStateFlow()

    init {
        load(page = 1)
    }

    fun loadMore() {
        if (_uiState.value.loadingMore || !_uiState.value.hasMore) return
        load(page = _uiState.value.page + 1, appending = true)
    }

    private fun load(page: Int, appending: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !appending, loadingMore = appending, errorMessage = null) }
            try {
                val response = gamesRepository.discover(page)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        loadingMore = false,
                        results = if (appending) it.results + response.results else response.results,
                        page = response.page,
                        hasMore = response.hasMore,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, loadingMore = false, errorMessage = "Falha ao carregar.")
                }
            }
        }
    }
}
