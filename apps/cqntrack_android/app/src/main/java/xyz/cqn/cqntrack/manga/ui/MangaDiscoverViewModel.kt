package xyz.cqn.cqntrack.manga.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.manga.data.MangaRepository
import xyz.cqn.cqntrack.manga.data.MangaSummaryDto
import javax.inject.Inject

data class MangaDiscoverUiState(
    val isLoading: Boolean = true,
    val results: List<MangaSummaryDto> = emptyList(),
    val page: Int = 1,
    val hasMore: Boolean = false,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
)

/** Populares reais da própria MangaDex (GET /api/manga/discover, order[followedCount]). */
@HiltViewModel
class MangaDiscoverViewModel @Inject constructor(
    private val mangaRepository: MangaRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MangaDiscoverUiState())
    val uiState: StateFlow<MangaDiscoverUiState> = _uiState.asStateFlow()

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
                val response = mangaRepository.discover(page)
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
