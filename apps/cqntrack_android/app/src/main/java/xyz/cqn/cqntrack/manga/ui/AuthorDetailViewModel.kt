package xyz.cqn.cqntrack.manga.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.manga.data.AuthorMangaResponseDto
import xyz.cqn.cqntrack.manga.data.MangaRepository
import javax.inject.Inject

data class AuthorDetailUiState(
    val isLoading: Boolean = true,
    val author: AuthorMangaResponseDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class AuthorDetailViewModel @Inject constructor(
    private val mangaRepository: MangaRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // Nome precisa bater com NavRoutes.MANGA_AUTHOR_DETAIL ("{authorId}").
    private val authorId: String = checkNotNull(savedStateHandle["authorId"])

    private val _uiState = MutableStateFlow(AuthorDetailUiState())
    val uiState: StateFlow<AuthorDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = mangaRepository.getAuthor(authorId)
                _uiState.update { it.copy(isLoading = false, author = response) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }
}
