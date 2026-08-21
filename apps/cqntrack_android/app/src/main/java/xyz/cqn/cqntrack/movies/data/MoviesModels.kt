package xyz.cqn.cqntrack.movies.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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

/** Espelha MovieDetailSchema (MovieSummarySchema + overview; sem cast/directors nesta versão). */
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
