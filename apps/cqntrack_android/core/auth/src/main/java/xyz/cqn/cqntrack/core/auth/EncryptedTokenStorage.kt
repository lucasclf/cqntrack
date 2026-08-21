package xyz.cqn.cqntrack.core.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import xyz.cqn.cqntrack.core.network.TokenProvider
import javax.inject.Inject
import javax.inject.Singleton

private const val PREFS_NAME = "cqntrack_auth"
private const val KEY_TOKEN = "bearer_token"

/**
 * Implementação real do bearer token store. Diferente do
 * @capacitor/preferences usado hoje pelo app web-mobile
 * (mobile-token-storage.ts) — que é SharedPreferences em texto puro —, aqui
 * o valor fica criptografado com uma chave gerenciada pelo Android Keystore
 * (MasterKey), nunca legível fora do processo do app mesmo com o
 * dispositivo comprometido/rooted. Implementa as duas interfaces
 * (TokenStorage é o contrato de domínio deste módulo; TokenProvider é o que
 * :core:network enxerga) pra não duplicar uma classe wrapper sem ganho real
 * nesta primeira versão.
 */
@Singleton
class EncryptedTokenStorage @Inject constructor(
    @ApplicationContext context: Context,
) : TokenStorage, TokenProvider {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val _isLoggedIn = MutableStateFlow(prefs.contains(KEY_TOKEN))
    override val isLoggedIn: StateFlow<Boolean> = _isLoggedIn

    override suspend fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    override suspend fun currentToken(): String? = getToken()

    override suspend fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
        _isLoggedIn.value = true
    }

    override suspend fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
        _isLoggedIn.value = false
    }
}
