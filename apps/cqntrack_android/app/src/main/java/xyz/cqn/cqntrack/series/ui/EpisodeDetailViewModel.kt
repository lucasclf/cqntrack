package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.SeriesEpisodeDetailDto
import xyz.cqn.cqntrack.series.data.SeriesRepository
import javax.inject.Inject

data class EpisodeDetailUiState(
    val isLoading: Boolean = true,
    val episode: SeriesEpisodeDetailDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class EpisodeDetailViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // Nomes precisam bater com NavRoutes.SERIES_EPISODE_DETAIL.
    private val tmdbId: Int = checkNotNull(savedStateHandle.get<String>("tmdbId")).toInt()
    private val seasonNumber: Int = checkNotNull(savedStateHandle.get<String>("seasonNumber")).toInt()
    private val episodeNumber: Int = checkNotNull(savedStateHandle.get<String>("episodeNumber")).toInt()

    private val _uiState = MutableStateFlow(EpisodeDetailUiState())
    val uiState: StateFlow<EpisodeDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val episode = seriesRepository.getEpisodeDetail(tmdbId, seasonNumber, episodeNumber)
                _uiState.update { it.copy(isLoading = false, episode = episode) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    /** Otimista: atualiza a UI antes da resposta, reverte se a chamada falhar — mesmo padrão de SeriesDetailViewModel.toggleEpisode. */
    fun toggleWatched() {
        val current = _uiState.value.episode ?: return
        val nextWatched = !current.watched
        _uiState.update { it.copy(episode = current.copy(watched = nextWatched)) }
        viewModelScope.launch {
            try {
                seriesRepository.setEpisodeWatched(tmdbId, seasonNumber, episodeNumber, nextWatched)
            } catch (e: Exception) {
                _uiState.update { it.copy(episode = current, errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }
}
