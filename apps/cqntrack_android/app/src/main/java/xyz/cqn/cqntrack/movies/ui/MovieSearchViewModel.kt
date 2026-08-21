package xyz.cqn.cqntrack.movies.ui

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
import xyz.cqn.cqntrack.movies.data.MovieSummaryDto
import xyz.cqn.cqntrack.movies.data.MoviesRepository
import javax.inject.Inject

data class MovieSearchUiState(
    val query: String = "",
    val results: List<MovieSummaryDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

private const val DEBOUNCE_MS = 300L

@OptIn(FlowPreview::class)
@HiltViewModel
class MovieSearchViewModel @Inject constructor(
    private val moviesRepository: MoviesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MovieSearchUiState())
    val uiState: StateFlow<MovieSearchUiState> = _uiState.asStateFlow()

    private val queryFlow = MutableStateFlow("")

    init {
        viewModelScope.launch {
            queryFlow
                .drop(1)
                .debounce(DEBOUNCE_MS)
                .distinctUntilChanged()
                .collectLatest { query -> runSearch(query) }
        }
    }

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value) }
        queryFlow.value = value
    }

    private suspend fun runSearch(query: String) {
        if (query.isBlank()) {
            _uiState.update { it.copy(results = emptyList(), isLoading = false, errorMessage = null) }
            return
        }
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        try {
            val results = moviesRepository.search(query)
            _uiState.update { it.copy(results = results, isLoading = false) }
        } catch (e: Exception) {
            _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao buscar. Tente de novo.") }
        }
    }
}
