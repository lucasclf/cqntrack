package xyz.cqn.cqntrack.core.auth

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response as OkHttpResponse
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import retrofit2.Response

private const val FAKE_URL = "https://api.track.cqn.xyz.br/api/auth/sign-in/email"

private fun rawResponse(code: Int, headers: Map<String, String> = emptyMap()): OkHttpResponse {
    val builder = OkHttpResponse.Builder()
        .request(Request.Builder().url(FAKE_URL).build())
        .protocol(Protocol.HTTP_1_1)
        .code(code)
        .message(if (code in 200..299) "OK" else "Error")
    headers.forEach { (name, value) -> builder.header(name, value) }
    return builder.build()
}

private fun emptyBody() = "".toResponseBody("application/json".toMediaType())

/**
 * Cobre o caminho que mais importa aqui: o token vem do HEADER da resposta
 * (`set-auth-token`), não do corpo — é fácil quebrar isso silenciosamente
 * trocando pra um DTO de corpo tipado sem perceber que o header parou de
 * ser lido. Ver AuthRepository.handleAuthResponse.
 */
class AuthRepositoryTest {

    private val authApi: AuthApi = mockk()
    private val tokenStorage: TokenStorage = mockk(relaxed = true) {
        every { isLoggedIn } returns MutableStateFlow(false)
    }
    private val repository = AuthRepository(authApi, tokenStorage)

    @Test
    fun `signIn bem-sucedido guarda o token do header set-auth-token`() = runTest {
        val response = Response.success(
            emptyBody(),
            rawResponse(200, mapOf("set-auth-token" to "tok_abc123")),
        )
        coEvery { authApi.signIn(SignInRequest("a@b.com", "senha123")) } returns response

        val result = repository.signIn("a@b.com", "senha123")

        assertEquals(AuthResult.Success, result)
        coVerify { tokenStorage.saveToken("tok_abc123") }
    }

    @Test
    fun `signIn com 401 devolve Error sem guardar token`() = runTest {
        val response = Response.error<okhttp3.ResponseBody>(401, emptyBody())
        coEvery { authApi.signIn(any()) } returns response

        val result = repository.signIn("a@b.com", "senha_errada")

        assertTrue(result is AuthResult.Error)
        coVerify(exactly = 0) { tokenStorage.saveToken(any()) }
    }

    @Test
    fun `signIn bem-sucedido sem header set-auth-token devolve Error`() = runTest {
        val response = Response.success(emptyBody(), rawResponse(200))
        coEvery { authApi.signIn(any()) } returns response

        val result = repository.signIn("a@b.com", "senha123")

        assertTrue(result is AuthResult.Error)
        coVerify(exactly = 0) { tokenStorage.saveToken(any()) }
    }
}
