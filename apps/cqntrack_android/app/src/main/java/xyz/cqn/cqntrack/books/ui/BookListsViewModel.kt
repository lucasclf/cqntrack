package xyz.cqn.cqntrack.books.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.books.data.BookListDto
import xyz.cqn.cqntrack.books.data.BookListsRepository
import xyz.cqn.cqntrack.books.data.CreateBookListRequestDto
import javax.inject.Inject

data class BookListsUiState(
    val isLoading: Boolean = true,
    val lists: List<BookListDto> = emptyList(),
    val errorMessage: String? = null,
    val isCreating: Boolean = false,
)

@HiltViewModel
class BookListsViewModel @Inject constructor(
    private val bookListsRepository: BookListsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(BookListsUiState())
    val uiState: StateFlow<BookListsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val lists = bookListsRepository.getLists()
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
                bookListsRepository.createList(CreateBookListRequestDto(name, description?.ifBlank { null }))
                _uiState.update { it.copy(isCreating = false) }
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(isCreating = false, errorMessage = "Falha ao criar lista.") }
            }
        }
    }
}
