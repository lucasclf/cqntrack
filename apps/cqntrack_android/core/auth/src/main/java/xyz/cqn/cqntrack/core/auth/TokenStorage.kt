package xyz.cqn.cqntrack.core.auth

import kotlinx.coroutines.flow.StateFlow

interface TokenStorage {
    /** Emite true assim que há um token guardado — a UI observa isso pra decidir a tela inicial. */
    val isLoggedIn: StateFlow<Boolean>

    suspend fun getToken(): String?
    suspend fun saveToken(token: String)
    suspend fun clearToken()
}
