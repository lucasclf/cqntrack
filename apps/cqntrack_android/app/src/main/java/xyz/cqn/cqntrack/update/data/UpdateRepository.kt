package xyz.cqn.cqntrack.update.data

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import javax.inject.Inject
import javax.inject.Singleton

// Link estável do GitHub Releases — sempre aponta pro asset do release mais recente,
// sem precisar montar a URL a partir da tag (ver skill android-release: o asset publicado
// precisa se chamar exatamente "cqntrack.apk" pra esse link funcionar).
private const val APK_DOWNLOAD_URL = "https://github.com/lucasclf/cqntrack/releases/latest/download/cqntrack.apk"

@Singleton
class UpdateRepository @Inject constructor(
    private val updateApi: UpdateApi,
) {
    /**
     * Retorna o nome da versão mais nova (ex.: "1.3.0") se for mais recente que `currentVersion`,
     * ou null se já está atualizado — ou se a checagem falhar (sem internet, GitHub fora do ar,
     * etc.). Falha aqui nunca deve incomodar o usuário, é só uma checagem silenciosa em segundo
     * plano.
     */
    suspend fun checkForNewerVersion(currentVersion: String): String? =
        try {
            val latest = updateApi.getLatestRelease().tagName.removePrefix("v")
            if (isNewerVersion(latest, currentVersion)) latest else null
        } catch (e: Exception) {
            null
        }

    /**
     * Só baixa o APK (DownloadManager, notificação nativa do Android quando terminar) — não
     * instala sozinho. O usuário abre a notificação/arquivo baixado e instala manualmente
     * (decisão deliberada: ver conversa sobre riscos de instalar automaticamente).
     * `setDestinationInExternalFilesDir` não exige permissão de armazenamento em nenhuma versão
     * do Android (é a pasta própria do app), diferente de `setDestinationInExternalPublicDir`.
     */
    fun enqueueApkDownload(context: Context, version: String) {
        val downloadManager = context.getSystemService(DownloadManager::class.java)
        val request = DownloadManager.Request(Uri.parse(APK_DOWNLOAD_URL))
            .setTitle("cqntrack $version")
            .setDescription("Baixando atualização do cqntrack")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "cqntrack.apk")
            .setMimeType("application/vnd.android.package-archive")
        downloadManager.enqueue(request)
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
