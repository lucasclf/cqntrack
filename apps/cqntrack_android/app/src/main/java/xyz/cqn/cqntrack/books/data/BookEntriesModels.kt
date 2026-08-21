package xyz.cqn.cqntrack.books.data

import kotlinx.serialization.Serializable

/** Espelha BookEntryWithBookSchema (BookEntrySchema + book) — usado na listagem "Minhas marcações". */
@Serializable
data class BookEntryWithBookDto(
    val id: String,
    val status: BookStatus? = null,
    val rating: Double? = null,
    val favoritedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
    val book: BookSummaryDto,
)

@Serializable
data class PaginatedBookEntriesResponseDto(
    val items: List<BookEntryWithBookDto>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)
