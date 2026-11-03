package xyz.cqn.cqntrack.core.network

/**
 * Abstração que o [AuthInterceptor] consome para anexar o bearer token —
 * definida aqui (não em :core:auth) para :core:network não depender de
 * :core:auth. Quem implementa de verdade (lendo do EncryptedSharedPreferences)
 * é o módulo :core:auth, ligado via Hilt (@Binds em AuthModule).
 */
interface TokenProvider {
    suspend fun currentToken(): String?

    /**
     * Descarta [token] só se ele ainda for o token guardado — uma resposta 401
     * atrasada de um token antigo não pode derrubar um login feito nesse meio-tempo.
     */
    suspend fun clearTokenIfCurrent(token: String)
}
