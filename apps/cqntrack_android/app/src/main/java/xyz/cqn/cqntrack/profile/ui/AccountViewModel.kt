package xyz.cqn.cqntrack.profile.ui

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import xyz.cqn.cqntrack.core.auth.AuthRepository
import xyz.cqn.cqntrack.core.auth.AuthResult
import xyz.cqn.cqntrack.profile.data.AuthUserDto
import xyz.cqn.cqntrack.profile.data.ProfileRepository
import javax.inject.Inject

// Mesmos limites de PUT /api/me/avatar (ver app.ts) — validados aqui primeiro
// pra dar feedback imediato sem gastar um request num arquivo que o backend
// ia rejeitar de qualquer forma, mesmo espírito de AvatarUpload.tsx no web.
private val ALLOWED_AVATAR_TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/gif")
private const val MAX_AVATAR_BYTES = 5 * 1024 * 1024

data class AccountUiState(
    val isLoading: Boolean = true,
    val user: AuthUserDto? = null,
    val errorMessage: String? = null,
    val nameSaving: Boolean = false,
    val nameSaved: Boolean = false,
    val nameError: String? = null,
    val passwordSaving: Boolean = false,
    val passwordSaved: Boolean = false,
    val passwordError: String? = null,
    val avatarUrl: String? = null,
    val avatarUploading: Boolean = false,
    val avatarError: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val profileRepository: ProfileRepository,
    private val authRepository: AuthRepository,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AccountUiState())
    val uiState: StateFlow<AccountUiState> = _uiState.asStateFlow()

    init {
        load()
        viewModelScope.launch {
            _uiState.update { it.copy(avatarUrl = authRepository.getAvatarUrl()) }
        }
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

    fun updateName(name: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(nameSaving = true, nameSaved = false, nameError = null) }
            when (val result = authRepository.updateName(name)) {
                is AuthResult.Success -> {
                    _uiState.update {
                        it.copy(
                            nameSaving = false,
                            nameSaved = true,
                            user = it.user?.copy(name = name),
                        )
                    }
                }
                is AuthResult.Error -> {
                    _uiState.update { it.copy(nameSaving = false, nameError = "Falha ao salvar o nome.") }
                }
            }
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(passwordSaving = true, passwordSaved = false, passwordError = null) }
            when (authRepository.changePassword(currentPassword, newPassword)) {
                is AuthResult.Success -> {
                    _uiState.update { it.copy(passwordSaving = false, passwordSaved = true) }
                }
                is AuthResult.Error -> {
                    _uiState.update {
                        it.copy(
                            passwordSaving = false,
                            passwordError = "Senha atual incorreta ou nova senha inválida.",
                        )
                    }
                }
            }
        }
    }

    // Não precisa navegar daqui — CqntrackNavHost observa
    // AuthRepository.isLoggedIn e volta pro login sozinho quando o token é
    // limpo, mesmo mecanismo já usado pro caminho inverso (login -> Home).
    fun signOut() {
        viewModelScope.launch { authRepository.signOut() }
    }

    /**
     * Sobe a imagem (PUT /api/me/avatar) e depois persiste a URL em
     * `user.image` via AuthRepository.updateImage — dois passos separados,
     * mesmo fluxo de AvatarUpload.tsx no web (a rota de upload é só um
     * proxy assinado pro Cloudinary, não mexe na sessão).
     */
    fun uploadAvatar(uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(avatarUploading = true, avatarError = null) }

            val mimeType = context.contentResolver.getType(uri)
            if (mimeType == null || mimeType !in ALLOWED_AVATAR_TYPES) {
                _uiState.update {
                    it.copy(avatarUploading = false, avatarError = "Formato não suportado — use JPEG, PNG, WEBP ou GIF.")
                }
                return@launch
            }

            val bytes = try {
                context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            } catch (e: Exception) {
                null
            }
            if (bytes == null) {
                _uiState.update { it.copy(avatarUploading = false, avatarError = "Falha ao ler o arquivo.") }
                return@launch
            }
            if (bytes.size > MAX_AVATAR_BYTES) {
                _uiState.update { it.copy(avatarUploading = false, avatarError = "Imagem muito grande — o limite é 5MB.") }
                return@launch
            }

            try {
                val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("file", "avatar", requestBody)
                val uploaded = profileRepository.uploadAvatar(part)

                when (authRepository.updateImage(uploaded.url)) {
                    is AuthResult.Success -> {
                        _uiState.update { it.copy(avatarUploading = false, avatarUrl = uploaded.url) }
                    }
                    is AuthResult.Error -> {
                        _uiState.update {
                            it.copy(
                                avatarUploading = false,
                                avatarError = "A imagem subiu, mas falhou ao salvar no perfil. Tente novamente.",
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(avatarUploading = false, avatarError = "Falha ao enviar a imagem. Tente novamente.") }
            }
        }
    }
}
