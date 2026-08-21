package xyz.cqn.cqntrack.books.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.books.data.BookEntryWithBookDto
import xyz.cqn.cqntrack.books.data.BookStatus
import xyz.cqn.cqntrack.books.data.BooksRepository
import javax.inject.Inject

enum class BookEntrySortField(val apiValue: String, val label: String) {
    UpdatedAt("updatedAt", "Atualizado"),
    Status("status", "Status"),
    Rating("rating", "Nota"),
    Favorite("favorite", "Favorito"),
}

data class BookEntriesUiState(
    val isLoading: Boolean = true,
    val items: List<BookEntryWithBookDto> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 24,
    val total: Int = 0,
    val statusFilter: BookStatus? = null,
    val favoriteOnly: Boolean = false,
    val sortBy: BookEntrySortField = BookEntrySortField.UpdatedAt,
    val order: String = "desc",
    val errorMessage: String? = null,
) {
    val totalPages: Int get() = if (total == 0) 1 else ((total - 1) / pageSize) + 1
}

/** Espelha MyBookEntries.tsx (web) — navegação/edição de "Minhas marcações", diferente de Descobrir (catálogo) e Minhas listas (custom). */
@HiltViewModel
class BookEntriesViewModel @Inject constructor(
    private val booksRepository: BooksRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(BookEntriesUiState())
    val uiState: StateFlow<BookEntriesUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val s = _uiState.value
            try {
                val response = booksRepository.getEntries(
                    status = s.statusFilter,
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

    fun setStatusFilter(status: BookStatus?) {
        _uiState.update { it.copy(statusFilter = status, page = 1) }
        load()
    }

    fun setFavoriteOnly(value: Boolean) {
        _uiState.update { it.copy(favoriteOnly = value, page = 1) }
        load()
    }

    fun setSortBy(sortBy: BookEntrySortField) {
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
