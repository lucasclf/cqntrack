package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.CreateSeriesListRequestDto
import xyz.cqn.cqntrack.series.data.SeriesListDto
import xyz.cqn.cqntrack.series.data.SeriesListsRepository
import javax.inject.Inject

data class SeriesListsUiState(
    val isLoading: Boolean = true,
    val lists: List<SeriesListDto> = emptyList(),
    val errorMessage: String? = null,
    val isCreating: Boolean = false,
)

@HiltViewModel
class SeriesListsViewModel @Inject constructor(
    private val seriesListsRepository: SeriesListsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SeriesListsUiState())
    val uiState: StateFlow<SeriesListsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val lists = seriesListsRepository.getLists()
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
                seriesListsRepository.createList(CreateSeriesListRequestDto(name, description?.ifBlank { null }))
                _uiState.update { it.copy(isCreating = false) }
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(isCreating = false, errorMessage = "Falha ao criar lista.") }
            }
        }
    }
}
