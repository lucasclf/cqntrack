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
import xyz.cqn.cqntrack.movies.data.MovieDetailDto
import xyz.cqn.cqntrack.movies.data.MovieEntryDto
import xyz.cqn.cqntrack.movies.data.MovieStatus
import xyz.cqn.cqntrack.movies.data.MoviesRepository
import xyz.cqn.cqntrack.movies.data.UpsertMovieEntryRequestDto
import javax.inject.Inject

data class MovieDetailUiState(
    val isLoading: Boolean = true,
    val movie: MovieDetailDto? = null,
    val entry: MovieEntryDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class MovieDetailViewModel @Inject constructor(
    private val moviesRepository: MoviesRepository,
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
}
