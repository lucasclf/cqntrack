package xyz.cqn.cqntrack.social.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.social.data.FriendActivityItemDto
import xyz.cqn.cqntrack.social.data.SocialRepository
import javax.inject.Inject

data class SocialActivityUiState(
    val isLoading: Boolean = true,
    val items: List<FriendActivityItemDto> = emptyList(),
    val nextCursor: String? = null,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
)

/** Aba "Atividades" da Social (GET /api/social/feed) — mesmo padrão cursor-paginado de ActivityViewModel, com autor. */
@HiltViewModel
class SocialActivityViewModel @Inject constructor(
    private val socialRepository: SocialRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SocialActivityUiState())
    val uiState: StateFlow<SocialActivityUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun loadMore() {
        val cursor = _uiState.value.nextCursor ?: return
        if (_uiState.value.loadingMore) return
        load(before = cursor, appending = true)
    }

    private fun load(before: String? = null, appending: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !appending, loadingMore = appending, errorMessage = null) }
            try {
                val response = socialRepository.getFeed(before, mediaType = null)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        loadingMore = false,
                        items = if (appending) it.items + response.items else response.items,
                        nextCursor = response.nextCursor,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, loadingMore = false, errorMessage = "Falha ao carregar a atividade dos seus amigos.")
                }
            }
        }
    }
}
