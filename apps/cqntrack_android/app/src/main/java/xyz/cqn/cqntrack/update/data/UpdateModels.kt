package xyz.cqn.cqntrack.update.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Só o campo que interessa da resposta de GET /repos/lucasclf/cqntrack/releases/latest — o resto é ignorado (Json.ignoreUnknownKeys). */
@Serializable
data class GithubReleaseDto(
    @SerialName("tag_name") val tagName: String,
)
