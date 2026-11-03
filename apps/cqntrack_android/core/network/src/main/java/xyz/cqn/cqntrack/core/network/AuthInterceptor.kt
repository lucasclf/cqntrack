package xyz.cqn.cqntrack.core.network

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * Espelha authHeaders() de apps/cqntrack_fe/src/lib/api-client.mobile.ts:
 * mesma ideia (Bearer token em vez de cookie), versão nativa. O backend já
 * suporta isso via plugin bearer() do better-auth — ver
 * apps/cqntrack_be/src/auth/auth.ts — nenhuma mudança de servidor necessária.
 *
 * `runBlocking` é aceitável aqui: interceptors OkHttp rodam numa thread de
 * dispatcher dedicada (não a main thread), e a leitura do token
 * (EncryptedSharedPreferences) é rápida e local — não bloqueia UI.
 *
 * 401 numa requisição que levou token significa sessão expirada/revogada (o
 * backend só devolve 401 em requireSession; senha atual errada é 400). Sem
 * descartar o token, o app continuaria "logado" com todas as telas falhando —
 * descartado, isLoggedIn vira false e o CqntrackNavHost volta pro login sozinho.
 * Requisição sem token (login com senha errada) nunca passa por esse descarte.
 */
class AuthInterceptor @Inject constructor(
    private val tokenProvider: TokenProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenProvider.currentToken() }
        val request = chain.request().let { original ->
            if (token.isNullOrEmpty()) {
                original
            } else {
                original.newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
            }
        }
        val response = chain.proceed(request)
        if (response.code == 401 && !token.isNullOrEmpty()) {
            runBlocking { tokenProvider.clearTokenIfCurrent(token) }
        }
        return response
    }
}
