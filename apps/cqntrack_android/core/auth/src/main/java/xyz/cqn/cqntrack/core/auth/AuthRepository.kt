package xyz.cqn.cqntrack.core.auth

import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

sealed interface AuthResult {
    data object Success : AuthResult
    data class Error(val message: String) : AuthResult
}

private const val HEADER_TOKEN = "set-auth-token"

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenStorage: TokenStorage,
) {
    val isLoggedIn: StateFlow<Boolean> = tokenStorage.isLoggedIn

    suspend fun signIn(email: String, password: String): AuthResult {
        val response = runCatching { authApi.signIn(SignInRequest(email, password)) }
            .getOrElse { return AuthResult.Error("Falha de conexão. Tente novamente.") }
        return handleAuthResponse(response)
    }

    suspend fun signUp(name: String, username: String, email: String, password: String): AuthResult {
        val response = runCatching { authApi.signUp(SignUpRequest(name, username, email, password)) }
            .getOrElse { return AuthResult.Error("Falha de conexão. Tente novamente.") }
        // Cadastro não cria sessão de cara — requireEmailVerification está
        // ligado no backend (ver auth.ts), então não há `set-auth-token`
        // aqui mesmo em caso de sucesso. O usuário precisa confirmar o
        // e-mail e então logar (mesmo fluxo do web).
        return if (response.isSuccessful) {
            AuthResult.Success
        } else {
            AuthResult.Error(errorMessageFor(response.code()))
        }
    }

    suspend fun signOut() {
        runCatching { authApi.signOut() }
        tokenStorage.clearToken()
    }

    suspend fun updateName(name: String): AuthResult {
        val response = runCatching { authApi.updateUser(buildJsonObject { put("name", name) }) }
            .getOrElse { return AuthResult.Error("Falha de conexão. Tente novamente.") }
        return if (response.isSuccessful) {
            AuthResult.Success
        } else {
            AuthResult.Error(errorMessageFor(response.code()))
        }
    }

    suspend fun updateImage(url: String): AuthResult {
        val response = runCatching { authApi.updateUser(buildJsonObject { put("image", url) }) }
            .getOrElse { return AuthResult.Error("Falha de conexão. Tente novamente.") }
        return if (response.isSuccessful) {
            AuthResult.Success
        } else {
            AuthResult.Error(errorMessageFor(response.code()))
        }
    }

    /** `null` tanto sem sessão quanto sem avatar definido — a tela de conta não distingue os dois casos. */
    suspend fun getAvatarUrl(): String? = runCatching { authApi.getSession()?.user?.image }.getOrNull()

    /**
     * `revokeOtherSessions = true` (mesmo comportamento do web) faz o servidor rotacionar o
     * token da sessão atual também — sem atualizar o token salvo aqui, as próximas chamadas
     * autenticadas falhariam com 401 até o usuário logar de novo.
     */
    suspend fun changePassword(currentPassword: String, newPassword: String): AuthResult {
        val response = runCatching {
            authApi.changePassword(ChangePasswordRequestDto(newPassword, currentPassword))
        }.getOrElse { return AuthResult.Error("Falha de conexão. Tente novamente.") }
        if (!response.isSuccessful) {
            return AuthResult.Error(errorMessageFor(response.code()))
        }
        response.headers()[HEADER_TOKEN]?.let { tokenStorage.saveToken(it) }
        return AuthResult.Success
    }

    private suspend fun handleAuthResponse(response: retrofit2.Response<okhttp3.ResponseBody>): AuthResult {
        if (!response.isSuccessful) {
            return AuthResult.Error(errorMessageFor(response.code()))
        }
        val token = response.headers()[HEADER_TOKEN]
            ?: return AuthResult.Error("Resposta do servidor sem token de sessão.")
        tokenStorage.saveToken(token)
        return AuthResult.Success
    }

    private fun errorMessageFor(status: Int): String = when (status) {
        401, 403 -> "E-mail ou senha inválidos, ou e-mail ainda não confirmado."
        429 -> "Muitas tentativas. Aguarde um pouco antes de tentar de novo."
        else -> "Não foi possível completar a operação (erro $status)."
    }
}
