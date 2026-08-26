package xyz.cqn.cqntrack.social.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.social.data.FollowedUserDto
import xyz.cqn.cqntrack.social.data.SocialRepository
import javax.inject.Inject

data class SocialFollowingUiState(
    val isLoading: Boolean = true,
    val items: List<FollowedUserDto> = emptyList(),
    val errorMessage: String? = null,
)

/** Aba "Listar" da Social — só avatar+nome de quem você segue (sem ação de deixar de seguir, mesmo espírito de FollowingList.tsx no web). */
@HiltViewModel
class SocialFollowingViewModel @Inject constructor(
    private val socialRepository: SocialRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SocialFollowingUiState())
    val uiState: StateFlow<SocialFollowingUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val items = socialRepository.getFollowing()
                _uiState.update { it.copy(isLoading = false, items = items) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar sua lista de amigos.") }
            }
        }
    }
}
