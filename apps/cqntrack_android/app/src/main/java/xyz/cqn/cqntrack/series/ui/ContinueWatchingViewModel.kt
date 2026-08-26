package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.ContinueWatchingItemDto
import xyz.cqn.cqntrack.series.data.SeriesRepository
import javax.inject.Inject

data class ContinueWatchingUiState(
    val isLoading: Boolean = true,
    val items: List<ContinueWatchingItemDto> = emptyList(),
    val nextCursor: Int? = 0,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
)

/** Espelha ContinueWatching.tsx no web — calculado ao vivo pelo backend, paginado por cursor (índice). */
@HiltViewModel
class ContinueWatchingViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ContinueWatchingUiState())
    val uiState: StateFlow<ContinueWatchingUiState> = _uiState.asStateFlow()

    init {
        load(cursor = 0)
    }

    fun loadMore() {
        val cursor = _uiState.value.nextCursor ?: return
        if (_uiState.value.loadingMore) return
        load(cursor = cursor, appending = true)
    }

    private fun load(cursor: Int, appending: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !appending, loadingMore = appending, errorMessage = null) }
            try {
                val response = seriesRepository.getContinueWatching(cursor)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        loadingMore = false,
                        items = if (appending) it.items + response.items else response.items,
                        nextCursor = response.nextCursor,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, loadingMore = false, errorMessage = "Falha ao carregar as séries em andamento.")
                }
            }
        }
    }
}
