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
import xyz.cqn.cqntrack.books.data.BookDetailDto
import xyz.cqn.cqntrack.books.data.BookEntryDto
import xyz.cqn.cqntrack.books.data.BookListDto
import xyz.cqn.cqntrack.books.data.BookListsRepository
import xyz.cqn.cqntrack.books.data.BookStatus
import xyz.cqn.cqntrack.books.data.BooksRepository
import xyz.cqn.cqntrack.books.data.CreateBookListRequestDto
import xyz.cqn.cqntrack.books.data.UpsertBookEntryRequestDto
import javax.inject.Inject

data class BookDetailUiState(
    val isLoading: Boolean = true,
    val book: BookDetailDto? = null,
    val entry: BookEntryDto? = null,
    val errorMessage: String? = null,
    val showAddToListDialog: Boolean = false,
    val availableLists: List<BookListDto> = emptyList(),
    val addToListMessage: String? = null,
)

@HiltViewModel
class BookDetailViewModel @Inject constructor(
    private val booksRepository: BooksRepository,
    private val bookListsRepository: BookListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // Nome do argumento precisa bater com NavRoutes.BOOK_DETAIL ("{googleBooksId}").
    private val googleBooksId: String = checkNotNull(savedStateHandle["googleBooksId"])

    private val _uiState = MutableStateFlow(BookDetailUiState())
    val uiState: StateFlow<BookDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = booksRepository.getDetail(googleBooksId)
                _uiState.update {
                    it.copy(isLoading = false, book = response.book, entry = response.entry)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    fun setStatus(status: BookStatus) = updateEntry(UpsertBookEntryRequestDto(status = status))

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertBookEntryRequestDto(favorited = !isFavorited))
    }

    fun setRating(rating: Double) = updateEntry(UpsertBookEntryRequestDto(rating = rating))

    /** Otimista seria mais responsivo, mas pra prova de conceito recarrega a entry do servidor após salvar — mesma fonte de verdade, menos estado pra sincronizar manualmente. */
    private fun updateEntry(body: UpsertBookEntryRequestDto) {
        viewModelScope.launch {
            try {
                val updated = booksRepository.upsertEntry(googleBooksId, body)
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
                val lists = bookListsRepository.getLists()
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
                bookListsRepository.addItem(listId, googleBooksId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao adicionar à lista.") }
            }
        }
    }

    fun createListAndAdd(name: String) {
        viewModelScope.launch {
            try {
                val list = bookListsRepository.createList(CreateBookListRequestDto(name))
                bookListsRepository.addItem(list.id, googleBooksId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao criar lista.") }
            }
        }
    }
}
