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
import xyz.cqn.cqntrack.series.data.SeriesDetailDto
import xyz.cqn.cqntrack.series.data.SeriesEntryDto
import xyz.cqn.cqntrack.series.data.SeriesRepository
import xyz.cqn.cqntrack.series.data.UpsertSeriesEntryRequestDto
import javax.inject.Inject

data class SeriesDetailUiState(
    val isLoading: Boolean = true,
    val series: SeriesDetailDto? = null,
    val entry: SeriesEntryDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class SeriesDetailViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val tmdbId: Int = checkNotNull(savedStateHandle.get<String>("tmdbId")).toInt()

    private val _uiState = MutableStateFlow(SeriesDetailUiState())
    val uiState: StateFlow<SeriesDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = seriesRepository.getDetail(tmdbId)
                _uiState.update {
                    it.copy(isLoading = false, series = response.series, entry = response.entry)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertSeriesEntryRequestDto(favorited = !isFavorited))
    }

    fun toggleAbandoned() {
        val isAbandoned = _uiState.value.entry?.abandonedAt != null
        updateEntry(UpsertSeriesEntryRequestDto(abandoned = !isAbandoned))
    }

    private fun updateEntry(body: UpsertSeriesEntryRequestDto) {
        viewModelScope.launch {
            try {
                val updated = seriesRepository.upsertEntry(tmdbId, body)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }
}
