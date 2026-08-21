package xyz.cqn.cqntrack.movies.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.movies.data.CreateMovieListRequestDto
import xyz.cqn.cqntrack.movies.data.MovieListDto
import xyz.cqn.cqntrack.movies.data.MovieListsRepository
import javax.inject.Inject

data class MovieListsUiState(
    val isLoading: Boolean = true,
    val lists: List<MovieListDto> = emptyList(),
    val errorMessage: String? = null,
    val isCreating: Boolean = false,
)

@HiltViewModel
class MovieListsViewModel @Inject constructor(
    private val movieListsRepository: MovieListsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MovieListsUiState())
    val uiState: StateFlow<MovieListsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val lists = movieListsRepository.getLists()
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
                movieListsRepository.createList(CreateMovieListRequestDto(name, description?.ifBlank { null }))
                _uiState.update { it.copy(isCreating = false) }
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(isCreating = false, errorMessage = "Falha ao criar lista.") }
            }
        }
    }
}
