package xyz.cqn.cqntrack.core.network

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class AuthInterceptorTest {

    private class FakeTokenProvider(var token: String?) : TokenProvider {
        override suspend fun currentToken(): String? = token

        override suspend fun clearTokenIfCurrent(token: String) {
            if (this.token == token) this.token = null
        }
    }

    /** Roda o interceptor de verdade contra uma resposta fixa, sem tocar a rede. */
    private fun execute(
        provider: TokenProvider,
        status: Int,
        onRequest: (Request) -> Unit = {},
    ) {
        val fakeServer = Interceptor { chain ->
            onRequest(chain.request())
            Response.Builder()
                .request(chain.request())
                .protocol(Protocol.HTTP_1_1)
                .code(status)
                .message("")
                .body("".toResponseBody())
                .build()
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(provider))
            .addInterceptor(fakeServer)
            .build()
        val request = Request.Builder().url("https://api.track.cqn.xyz.br/api/me").build()
        client.newCall(request).execute().close()
    }

    @Test
    fun `anexa o bearer token quando ha sessao`() {
        var header: String? = null

        execute(FakeTokenProvider("abc"), 200, onRequest = { header = it.header("Authorization") })

        assertEquals("Bearer abc", header)
    }

    @Test
    fun `401 com token descarta a sessao`() {
        val provider = FakeTokenProvider("abc")

        execute(provider, 401)

        assertNull(provider.token)
    }

    @Test
    fun `resposta diferente de 401 mantem a sessao`() {
        for (status in listOf(200, 400, 403, 404, 429, 500)) {
            val provider = FakeTokenProvider("abc")

            execute(provider, status)

            assertEquals("abc", provider.token, "status $status")
        }
    }

    @Test
    fun `401 sem token nao tenta descartar nada`() {
        var cleared = false
        val provider = object : TokenProvider {
            override suspend fun currentToken(): String? = null
            override suspend fun clearTokenIfCurrent(token: String) {
                cleared = true
            }
        }

        execute(provider, 401)

        assertEquals(false, cleared)
    }

    @Test
    fun `401 atrasado de token antigo nao derruba login novo`() {
        val provider = FakeTokenProvider("antigo")

        execute(provider, 401, onRequest = { provider.token = "novo" })

        assertEquals("novo", provider.token)
    }
}
