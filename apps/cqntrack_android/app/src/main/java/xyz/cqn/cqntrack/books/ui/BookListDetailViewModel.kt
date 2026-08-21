package xyz.cqn.cqntrack.books.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.books.data.BookListDetailDto
import xyz.cqn.cqntrack.books.data.BookListsRepository
import javax.inject.Inject

data class BookListDetailUiState(
    val isLoading: Boolean = true,
    val list: BookListDetailDto? = null,
    val errorMessage: String? = null,
    val isDeleted: Boolean = false,
)

@HiltViewModel
class BookListDetailViewModel @Inject constructor(
    private val bookListsRepository: BookListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val listId: String = checkNotNull(savedStateHandle["listId"])

    private val _uiState = MutableStateFlow(BookListDetailUiState())
    val uiState: StateFlow<BookListDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val list = bookListsRepository.getListDetail(listId)
                _uiState.update { it.copy(isLoading = false, list = list) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar lista.") }
            }
        }
    }

    fun removeItem(googleBooksId: String) {
        viewModelScope.launch {
            try {
                bookListsRepository.removeItem(listId, googleBooksId)
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover item.") }
            }
        }
    }

    fun deleteList() {
        viewModelScope.launch {
            try {
                bookListsRepository.deleteList(listId)
                _uiState.update { it.copy(isDeleted = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao excluir lista.") }
            }
        }
    }
}
