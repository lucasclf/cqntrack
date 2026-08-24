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
import xyz.cqn.cqntrack.books.data.AuthorBooksResponseDto
import xyz.cqn.cqntrack.books.data.BooksRepository
import javax.inject.Inject

data class AuthorDetailUiState(
    val isLoading: Boolean = true,
    val author: AuthorBooksResponseDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class AuthorDetailViewModel @Inject constructor(
    private val booksRepository: BooksRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // Nome precisa bater com NavRoutes.BOOK_AUTHOR_DETAIL ("{name}"), já decodificado pelo Navigation Compose.
    private val name: String = checkNotNull(savedStateHandle["name"])

    private val _uiState = MutableStateFlow(AuthorDetailUiState())
    val uiState: StateFlow<AuthorDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = booksRepository.getAuthor(name)
                _uiState.update { it.copy(isLoading = false, author = response) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }
}
