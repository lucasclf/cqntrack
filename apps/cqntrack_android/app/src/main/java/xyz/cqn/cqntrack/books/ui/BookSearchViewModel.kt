package xyz.cqn.cqntrack.books.ui

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
import xyz.cqn.cqntrack.books.data.BookSummaryDto
import xyz.cqn.cqntrack.books.data.BooksRepository
import javax.inject.Inject

data class BookSearchUiState(
    val query: String = "",
    val results: List<BookSummaryDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

private const val DEBOUNCE_MS = 300L

/** Mesmo debounce de 300ms usado em BookSearch.tsx (web) — mesma UX, cliente diferente. */
@OptIn(FlowPreview::class)
@HiltViewModel
class BookSearchViewModel @Inject constructor(
    private val booksRepository: BooksRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(BookSearchUiState())
    val uiState: StateFlow<BookSearchUiState> = _uiState.asStateFlow()

    private val queryFlow = MutableStateFlow("")

    init {
        viewModelScope.launch {
            queryFlow
                .drop(1) // ignora o valor inicial vazio — nada a buscar ainda
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
            val results = booksRepository.search(query)
            _uiState.update { it.copy(results = results, isLoading = false) }
        } catch (e: Exception) {
            _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao buscar. Tente de novo.") }
        }
    }
}
