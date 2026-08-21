package xyz.cqn.cqntrack.movies.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.movies.data.MovieListDetailDto
import xyz.cqn.cqntrack.movies.data.MovieListsRepository
import javax.inject.Inject

data class MovieListDetailUiState(
    val isLoading: Boolean = true,
    val list: MovieListDetailDto? = null,
    val errorMessage: String? = null,
    val isDeleted: Boolean = false,
)

@HiltViewModel
class MovieListDetailViewModel @Inject constructor(
    private val movieListsRepository: MovieListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val listId: String = checkNotNull(savedStateHandle["listId"])

    private val _uiState = MutableStateFlow(MovieListDetailUiState())
    val uiState: StateFlow<MovieListDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val list = movieListsRepository.getListDetail(listId)
                _uiState.update { it.copy(isLoading = false, list = list) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar lista.") }
            }
        }
    }

    fun removeItem(tmdbId: Int) {
        viewModelScope.launch {
            try {
                movieListsRepository.removeItem(listId, tmdbId)
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover item.") }
            }
        }
    }

    fun deleteList() {
        viewModelScope.launch {
            try {
                movieListsRepository.deleteList(listId)
                _uiState.update { it.copy(isDeleted = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao excluir lista.") }
            }
        }
    }
}
