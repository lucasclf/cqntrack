package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.SeriesEntryWithSeriesDto
import xyz.cqn.cqntrack.series.data.SeriesRepository
import javax.inject.Inject

/** Sem "status" — série não tem status próprio (ver SeriesEntrySchema). */
enum class SeriesEntrySortField(val apiValue: String, val label: String) {
    UpdatedAt("updatedAt", "Atualizado"),
    Rating("rating", "Nota"),
    Favorite("favorite", "Favorito"),
}

data class SeriesEntriesUiState(
    val isLoading: Boolean = true,
    val items: List<SeriesEntryWithSeriesDto> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 24,
    val total: Int = 0,
    val favoriteOnly: Boolean = false,
    val sortBy: SeriesEntrySortField = SeriesEntrySortField.UpdatedAt,
    val order: String = "desc",
    val errorMessage: String? = null,
) {
    val totalPages: Int get() = if (total == 0) 1 else ((total - 1) / pageSize) + 1
}

@HiltViewModel
class SeriesEntriesViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SeriesEntriesUiState())
    val uiState: StateFlow<SeriesEntriesUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val s = _uiState.value
            try {
                val response = seriesRepository.getEntries(
                    favorite = if (s.favoriteOnly) true else null,
                    sortBy = s.sortBy.apiValue,
                    order = s.order,
                    page = s.page,
                )
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        items = response.items,
                        page = response.page,
                        pageSize = response.pageSize,
                        total = response.total,
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar suas marcações.") }
            }
        }
    }

    fun setFavoriteOnly(value: Boolean) {
        _uiState.update { it.copy(favoriteOnly = value, page = 1) }
        load()
    }

    fun setSortBy(sortBy: SeriesEntrySortField) {
        _uiState.update { it.copy(sortBy = sortBy, page = 1) }
        load()
    }

    fun toggleOrder() {
        _uiState.update { it.copy(order = if (it.order == "desc") "asc" else "desc", page = 1) }
        load()
    }

    fun nextPage() {
        if (_uiState.value.page < _uiState.value.totalPages) {
            _uiState.update { it.copy(page = it.page + 1) }
            load()
        }
    }

    fun prevPage() {
        if (_uiState.value.page > 1) {
            _uiState.update { it.copy(page = it.page - 1) }
            load()
        }
    }
}
