package xyz.cqn.cqntrack.profile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.core.auth.AuthRepository
import xyz.cqn.cqntrack.profile.data.AuthUserDto
import xyz.cqn.cqntrack.profile.data.ProfileRepository
import javax.inject.Inject

data class AccountUiState(
    val isLoading: Boolean = true,
    val user: AuthUserDto? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val profileRepository: ProfileRepository,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AccountUiState())
    val uiState: StateFlow<AccountUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val user = profileRepository.getMe()
                _uiState.update { it.copy(isLoading = false, user = user) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    // Não precisa navegar daqui — CqntrackNavHost observa
    // AuthRepository.isLoggedIn e volta pro login sozinho quando o token é
    // limpo, mesmo mecanismo já usado pro caminho inverso (login -> Home).
    fun signOut() {
        viewModelScope.launch { authRepository.signOut() }
    }
}
