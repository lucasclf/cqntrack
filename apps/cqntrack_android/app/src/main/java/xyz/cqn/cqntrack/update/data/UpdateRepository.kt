package xyz.cqn.cqntrack.update.data

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UpdateRepository @Inject constructor(
    private val updateApi: UpdateApi,
) {
    /**
     * Retorna o nome da versão mais nova (ex.: "1.3.0") se for mais recente que `currentVersion`,
     * ou null se já está atualizado — ou se a checagem falhar (sem internet, GitHub fora do ar,
     * etc.). Falha aqui nunca deve incomodar o usuário, é só uma checagem silenciosa em segundo
     * plano. Só informa — quem baixa o APK é o site (ver HomeScreen.UpdateBanner), o app não
     * dispara download nem instala nada sozinho.
     */
    suspend fun checkForNewerVersion(currentVersion: String): String? =
        try {
            val latest = updateApi.getLatestRelease().tagName.removePrefix("v")
            if (isNewerVersion(latest, currentVersion)) latest else null
        } catch (e: Exception) {
            null
        }
}

/** Comparação semver simples (x.y.z, preenchendo com 0 se faltar componente) — suficiente pro versionamento do próprio projeto. */
private fun isNewerVersion(latest: String, current: String): Boolean {
    val latestParts = latest.split(".").mapNotNull { it.toIntOrNull() }
    val currentParts = current.split(".").mapNotNull { it.toIntOrNull() }
    for (i in 0 until maxOf(latestParts.size, currentParts.size)) {
        val l = latestParts.getOrElse(i) { 0 }
        val c = currentParts.getOrElse(i) { 0 }
        if (l != c) return l > c
    }
    return false
}
