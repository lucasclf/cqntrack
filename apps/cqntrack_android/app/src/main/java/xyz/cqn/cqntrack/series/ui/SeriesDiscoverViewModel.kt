package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.SeriesRepository
import xyz.cqn.cqntrack.series.data.SeriesSummaryDto
import javax.inject.Inject

data class SeriesDiscoverUiState(
    val isLoading: Boolean = true,
    val results: List<SeriesSummaryDto> = emptyList(),
    val page: Int = 1,
    val hasMore: Boolean = false,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
)

/** Populares reais da própria TMDB (GET /api/series/discover). */
@HiltViewModel
class SeriesDiscoverViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SeriesDiscoverUiState())
    val uiState: StateFlow<SeriesDiscoverUiState> = _uiState.asStateFlow()

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
                val response = seriesRepository.discover(page)
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
