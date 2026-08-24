package xyz.cqn.cqntrack.people.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Espelha CastMemberSchema em packages/shared/src/credits.ts — top 10 do
 * elenco por relevância da própria TMDB, não a lista completa. Compartilhado
 * entre filme e série (mesmo formato nos dois).
 */
@Serializable
data class CastMemberDto(
    val personId: Int,
    val name: String,
    val character: String,
    val profileUrl: String? = null,
)

/**
 * Espelha CrewMemberSchema. Usado tanto pra "Direção" de filme quanto
 * "Criado por"/"Direção" de série quanto diretor de episódio —
 * `episodeCount` só vem preenchido em "Direção" de série (espelha o
 * intersection type opcional `CrewMember & { episodeCount?: number }` do
 * CrewList.tsx no web, em vez de um DTO `SeriesDirector` à parte).
 */
@Serializable
data class CrewMemberDto(
    val personId: Int,
    val name: String,
    val profileUrl: String? = null,
    val episodeCount: Int? = null,
)

/** Espelha PersonDetailSchema em packages/shared/src/people.ts. */
@Serializable
data class PersonDetailDto(
    val personId: Int,
    val name: String,
    val profileUrl: String? = null,
    val biography: String? = null,
)

/** Espelha PersonCreditItemSchema.mediaType — usado pra decidir a rota de navegação do crédito. */
@Serializable
enum class PersonCreditMediaType {
    @SerialName("movies") Movies,
    @SerialName("series") Series,
}

/** Espelha PersonCreditItemSchema — `roleLabel` já vem formatado pelo backend (personagem, ou "Diretor"/"Criador"/"Criador e diretor"). */
@Serializable
data class PersonCreditItemDto(
    val mediaType: PersonCreditMediaType,
    val id: Int,
    val title: String,
    val posterUrl: String? = null,
    val releaseDate: String? = null,
    val roleLabel: String,
)

/** Espelha PersonCreditsResponseSchema — sem cache, buscado ao vivo na TMDB a cada acesso. */
@Serializable
data class PersonCreditsResponseDto(
    val person: PersonDetailDto,
    val actingCredits: List<PersonCreditItemDto>,
    val directingCredits: List<PersonCreditItemDto>,
)
