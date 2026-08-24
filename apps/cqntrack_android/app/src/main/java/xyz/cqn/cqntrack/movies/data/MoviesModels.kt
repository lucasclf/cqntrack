package xyz.cqn.cqntrack.movies.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import xyz.cqn.cqntrack.people.data.CastMemberDto
import xyz.cqn.cqntrack.people.data.CrewMemberDto

/** Espelha MovieSummarySchema em packages/shared/src/movies.ts. */
@Serializable
data class MovieSummaryDto(
    val tmdbId: Int,
    val name: String,
    val posterUrl: String? = null,
    val releaseDate: String? = null,
    val genres: List<String>,
    val runtime: Int? = null,
    val rating: Double? = null,
)

/** Espelha MovieDetailSchema (MovieSummarySchema + overview + cast/directors). */
@Serializable
data class MovieDetailDto(
    val tmdbId: Int,
    val name: String,
    val posterUrl: String? = null,
    val releaseDate: String? = null,
    val genres: List<String>,
    val runtime: Int? = null,
    val rating: Double? = null,
    val overview: String? = null,
    val cast: List<CastMemberDto> = emptyList(),
    val directors: List<CrewMemberDto> = emptyList(),
)

/** Espelha MOVIE_STATUSES em packages/shared/src/movies.ts (fonte única de verdade lá). */
@Serializable
enum class MovieStatus {
    @SerialName("watched") Watched,
    @SerialName("want_to_watch") WantToWatch,
}

/** Espelha MovieEntrySchema. */
@Serializable
data class MovieEntryDto(
    val id: String,
    val status: MovieStatus? = null,
    val rating: Double? = null,
    val watchedAt: String? = null,
    val favoritedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
)

@Serializable
data class SearchMoviesResponseDto(
    val results: List<MovieSummaryDto>,
)

/** Espelha DiscoverMoviesResponseSchema — populares reais via GET /api/movies/discover. */
@Serializable
data class DiscoverMoviesResponseDto(
    val results: List<MovieSummaryDto>,
    val page: Int,
    val hasMore: Boolean,
)

@Serializable
data class MovieDetailResponseDto(
    val movie: MovieDetailDto,
    val entry: MovieEntryDto? = null,
)

@Serializable
data class UpsertMovieEntryRequestDto(
    val status: MovieStatus? = null,
    val rating: Double? = null,
    val review: String? = null,
    val favorited: Boolean? = null,
)
