package xyz.cqn.cqntrack.books.data

import kotlinx.serialization.Serializable

/** Espelha BookListSchema em packages/shared/src/books.ts. */
@Serializable
data class BookListDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class BookListsResponseDto(
    val lists: List<BookListDto>,
)

/** Espelha BookListDetailSchema (BookListSchema + items, catálogo dos livros da lista). */
@Serializable
data class BookListDetailDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val itemCount: Int,
    val createdAt: String,
    val updatedAt: String,
    val items: List<BookSummaryDto>,
)

@Serializable
data class CreateBookListRequestDto(
    val name: String,
    val description: String? = null,
)

@Serializable
data class UpdateBookListRequestDto(
    val name: String? = null,
    val description: String? = null,
)
