package xyz.cqn.cqntrack.social.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.profile.data.ProfileRepository
import xyz.cqn.cqntrack.social.data.FollowedUserDto
import xyz.cqn.cqntrack.social.data.SocialRepository
import javax.inject.Inject

private const val SEARCH_DEBOUNCE_MS = 300L
private const val PAGE_SIZE = 20

data class SocialSearchUiState(
    val query: String = "",
    val isLoading: Boolean = true,
    val items: List<FollowedUserDto> = emptyList(),
    val page: Int = 1,
    val total: Int = 0,
    val viewerUsername: String? = null,
    val errorMessage: String? = null,
) {
    val hasMore: Boolean get() = items.size < total
}

/** Aba "Procurar" da Social (GET /api/social/search) — diretório de outros usuários, `q` vazio devolve todo mundo, paginado por página. */
@HiltViewModel
class SocialSearchViewModel @Inject constructor(
    private val socialRepository: SocialRepository,
    private val profileRepository: ProfileRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SocialSearchUiState())
    val uiState: StateFlow<SocialSearchUiState> = _uiState.asStateFlow()

    private var debounceJob: Job? = null

    init {
        load(page = 1)
        // Precisa do próprio username pro FollowButton saber esconder-se quando o resultado é o
        // próprio viewer — mesmo padrão de PublicProfileViewModel.
        viewModelScope.launch {
            val me = runCatching { profileRepository.getMe() }.getOrNull()
            _uiState.update { it.copy(viewerUsername = me?.username) }
        }
    }

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value) }
        debounceJob?.cancel()
        debounceJob = viewModelScope.launch {
            delay(SEARCH_DEBOUNCE_MS)
            load(page = 1)
        }
    }

    fun loadMore() {
        if (_uiState.value.isLoading || !_uiState.value.hasMore) return
        load(page = _uiState.value.page + 1, appending = true)
    }

    private fun load(page: Int, appending: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = socialRepository.search(_uiState.value.query, page, PAGE_SIZE)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        items = if (appending) it.items + response.items else response.items,
                        page = response.page,
                        total = response.total,
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao buscar usuários.") }
            }
        }
    }
}
