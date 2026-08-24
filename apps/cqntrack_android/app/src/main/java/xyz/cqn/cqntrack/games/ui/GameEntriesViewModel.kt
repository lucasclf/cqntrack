package xyz.cqn.cqntrack.games.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.games.data.GameEntryWithGameDto
import xyz.cqn.cqntrack.games.data.GameStatus
import xyz.cqn.cqntrack.games.data.GamesRepository
import javax.inject.Inject

enum class GameEntrySortField(val apiValue: String, val label: String) {
    UpdatedAt("updatedAt", "Atualizado"),
    Status("status", "Status"),
    Rating("rating", "Nota"),
    Favorite("favorite", "Favorito"),
    Platform("platform", "Plataforma"),
}

private const val PLATFORM_DEBOUNCE_MS = 300L

data class GameEntriesUiState(
    val isLoading: Boolean = true,
    val items: List<GameEntryWithGameDto> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 24,
    val total: Int = 0,
    val statusFilter: GameStatus? = null,
    val favoriteOnly: Boolean = false,
    val platformFilter: String = "",
    val sortBy: GameEntrySortField = GameEntrySortField.UpdatedAt,
    val order: String = "desc",
    val errorMessage: String? = null,
) {
    val totalPages: Int get() = if (total == 0) 1 else ((total - 1) / pageSize) + 1
}

@OptIn(FlowPreview::class)
@HiltViewModel
class GameEntriesViewModel @Inject constructor(
    private val gamesRepository: GamesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(GameEntriesUiState())
    val uiState: StateFlow<GameEntriesUiState> = _uiState.asStateFlow()

    private val platformFlow = MutableStateFlow("")

    init {
        load()
        viewModelScope.launch {
            platformFlow
                .drop(1)
                .debounce(PLATFORM_DEBOUNCE_MS)
                .distinctUntilChanged()
                .collectLatest {
                    _uiState.update { it.copy(page = 1) }
                    load()
                }
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val s = _uiState.value
            try {
                val response = gamesRepository.getEntries(
                    status = s.statusFilter,
                    favorite = if (s.favoriteOnly) true else null,
                    platform = s.platformFilter.trim().ifBlank { null },
                    sortBy = s.sortBy.apiValue,
                    order = s.order,
                    page = s.page,
                )
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        items = response.items,
                        page = response.page,
                        pageSize = response.pageSize,
                        total = response.total,
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar suas marcações.") }
            }
        }
    }

    fun setStatusFilter(status: GameStatus?) {
        _uiState.update { it.copy(statusFilter = status, page = 1) }
        load()
    }

    fun setFavoriteOnly(value: Boolean) {
        _uiState.update { it.copy(favoriteOnly = value, page = 1) }
        load()
    }

    /** Debounced — ver `platformFlow` no init. Filtra/ordena por conter essa string na lista `platforms` da entry. */
    fun setPlatformFilter(value: String) {
        _uiState.update { it.copy(platformFilter = value) }
        platformFlow.value = value
    }

    fun setSortBy(sortBy: GameEntrySortField) {
        _uiState.update { it.copy(sortBy = sortBy, page = 1) }
        load()
    }

    fun toggleOrder() {
        _uiState.update { it.copy(order = if (it.order == "desc") "asc" else "desc", page = 1) }
        load()
    }

    fun nextPage() {
        if (_uiState.value.page < _uiState.value.totalPages) {
            _uiState.update { it.copy(page = it.page + 1) }
            load()
        }
    }

    fun prevPage() {
        if (_uiState.value.page > 1) {
            _uiState.update { it.copy(page = it.page - 1) }
            load()
        }
    }
}
