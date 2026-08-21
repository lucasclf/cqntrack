package xyz.cqn.cqntrack.movies.data

import kotlinx.serialization.Serializable

/** Espelha MovieEntryWithMovieSchema (MovieEntrySchema + movie) — usado na listagem "Minhas marcações". */
@Serializable
data class MovieEntryWithMovieDto(
    val id: String,
    val status: MovieStatus? = null,
    val rating: Double? = null,
    val watchedAt: String? = null,
    val favoritedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
    val movie: MovieSummaryDto,
)

@Serializable
data class PaginatedMovieEntriesResponseDto(
    val items: List<MovieEntryWithMovieDto>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)
