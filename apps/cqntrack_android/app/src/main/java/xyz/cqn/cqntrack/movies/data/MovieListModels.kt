package xyz.cqn.cqntrack.movies.data

import kotlinx.serialization.Serializable

/** Espelha MovieListSchema em packages/shared/src/movies.ts. */
@Serializable
data class MovieListDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class MovieListsResponseDto(
    val lists: List<MovieListDto>,
)

/** Espelha MovieListDetailSchema (MovieListSchema + items). */
@Serializable
data class MovieListDetailDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
    val items: List<MovieSummaryDto>,
)

@Serializable
data class CreateMovieListRequestDto(
    val name: String,
    val description: String? = null,
)

@Serializable
data class UpdateMovieListRequestDto(
    val name: String? = null,
    val description: String? = null,
)
