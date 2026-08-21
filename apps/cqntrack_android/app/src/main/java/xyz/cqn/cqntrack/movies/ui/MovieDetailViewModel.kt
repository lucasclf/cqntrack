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
import xyz.cqn.cqntrack.movies.data.CreateMovieListRequestDto
import xyz.cqn.cqntrack.movies.data.MovieDetailDto
import xyz.cqn.cqntrack.movies.data.MovieEntryDto
import xyz.cqn.cqntrack.movies.data.MovieListDto
import xyz.cqn.cqntrack.movies.data.MovieListsRepository
import xyz.cqn.cqntrack.movies.data.MovieStatus
import xyz.cqn.cqntrack.movies.data.MoviesRepository
import xyz.cqn.cqntrack.movies.data.UpsertMovieEntryRequestDto
import javax.inject.Inject

data class MovieDetailUiState(
    val isLoading: Boolean = true,
    val movie: MovieDetailDto? = null,
    val entry: MovieEntryDto? = null,
    val errorMessage: String? = null,
    val showAddToListDialog: Boolean = false,
    val availableLists: List<MovieListDto> = emptyList(),
    val addToListMessage: String? = null,
)

@HiltViewModel
class MovieDetailViewModel @Inject constructor(
    private val moviesRepository: MoviesRepository,
    private val movieListsRepository: MovieListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val tmdbId: Int = checkNotNull(savedStateHandle.get<String>("tmdbId")).toInt()

    private val _uiState = MutableStateFlow(MovieDetailUiState())
    val uiState: StateFlow<MovieDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = moviesRepository.getDetail(tmdbId)
                _uiState.update {
                    it.copy(isLoading = false, movie = response.movie, entry = response.entry)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    fun setStatus(status: MovieStatus) = updateEntry(UpsertMovieEntryRequestDto(status = status))

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertMovieEntryRequestDto(favorited = !isFavorited))
    }

    fun setRating(rating: Double?) {
        viewModelScope.launch {
            try {
                val updated = moviesRepository.setRating(tmdbId, rating)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun setReview(review: String?) {
        viewModelScope.launch {
            try {
                val updated = moviesRepository.setReview(tmdbId, review)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun removeEntry() {
        viewModelScope.launch {
            try {
                moviesRepository.deleteEntry(tmdbId)
                _uiState.update { it.copy(entry = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover marcação. Tente de novo.") }
            }
        }
    }

    private fun updateEntry(body: UpsertMovieEntryRequestDto) {
        viewModelScope.launch {
            try {
                val updated = moviesRepository.upsertEntry(tmdbId, body)
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
                val lists = movieListsRepository.getLists()
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
                movieListsRepository.addItem(listId, tmdbId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao adicionar à lista.") }
            }
        }
    }

    fun createListAndAdd(name: String) {
        viewModelScope.launch {
            try {
                val list = movieListsRepository.createList(CreateMovieListRequestDto(name))
                movieListsRepository.addItem(list.id, tmdbId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao criar lista.") }
            }
        }
    }
}
