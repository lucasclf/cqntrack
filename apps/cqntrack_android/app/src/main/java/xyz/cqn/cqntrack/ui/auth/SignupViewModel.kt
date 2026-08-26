package xyz.cqn.cqntrack.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.core.auth.AuthRepository
import xyz.cqn.cqntrack.core.auth.AuthResult
import javax.inject.Inject

data class SignupUiState(
    val name: String = "",
    val username: String = "",
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    /** true assim que o cadastro dá certo — backend exige confirmar o e-mail antes de logar
     * (requireEmailVerification, mesmo comportamento do web), então não há sessão pra reagir
     * aqui: a tela mostra um aviso e devolve o usuário pro Login manualmente. */
    val signupSucceeded: Boolean = false,
)

@HiltViewModel
class SignupViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SignupUiState())
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    fun onNameChange(value: String) = _uiState.update { it.copy(name = value, errorMessage = null) }
    fun onUsernameChange(value: String) = _uiState.update { it.copy(username = value, errorMessage = null) }
    fun onEmailChange(value: String) = _uiState.update { it.copy(email = value, errorMessage = null) }
    fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value, errorMessage = null) }

    fun submit() {
        val state = _uiState.value
        if (state.name.isBlank() || state.username.isBlank() || state.email.isBlank() || state.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Preencha todos os campos.") }
            return
        }
        if (state.password.length < 8) {
            _uiState.update { it.copy(errorMessage = "A senha precisa ter pelo menos 8 caracteres.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = authRepository.signUp(
                name = state.name.trim(),
                username = state.username.trim(),
                email = state.email.trim(),
                password = state.password,
            )
            when (result) {
                is AuthResult.Success -> _uiState.update { it.copy(isLoading = false, signupSucceeded = true) }
                is AuthResult.Error -> _uiState.update { it.copy(isLoading = false, errorMessage = result.message) }
            }
        }
    }
}
