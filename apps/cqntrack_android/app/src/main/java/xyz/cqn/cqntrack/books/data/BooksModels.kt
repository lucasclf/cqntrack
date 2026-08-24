package xyz.cqn.cqntrack.books.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Espelha BookSummarySchema em packages/shared/src/books.ts — manter os dois em sincronia. */
@Serializable
data class BookSummaryDto(
    val googleBooksId: String,
    val title: String,
    val authors: List<String>,
    val coverUrl: String? = null,
    val publishedDate: String? = null,
    val categories: List<String>,
    val pageCount: Int? = null,
    val rating: Double? = null,
)

/** Espelha BookDetailSchema (BookSummarySchema + description). */
@Serializable
data class BookDetailDto(
    val googleBooksId: String,
    val title: String,
    val authors: List<String>,
    val coverUrl: String? = null,
    val publishedDate: String? = null,
    val categories: List<String>,
    val pageCount: Int? = null,
    val rating: Double? = null,
    val description: String? = null,
)

/** Espelha BOOK_STATUSES em packages/shared/src/books.ts (fonte única de verdade lá). */
@Serializable
enum class BookStatus {
    @SerialName("want_to_read") WantToRead,
    @SerialName("reading") Reading,
    @SerialName("read") Read,
    @SerialName("dropped") Dropped,
}

/** Espelha BookEntrySchema. */
@Serializable
data class BookEntryDto(
    val id: String,
    val status: BookStatus? = null,
    val rating: Double? = null,
    val favoritedAt: String? = null,
    val review: String? = null,
    val updatedAt: String,
)

/** Espelha SearchBooksResponseSchema. */
@Serializable
data class SearchBooksResponseDto(
    val results: List<BookSummaryDto>,
)

/** Espelha BookDetailResponseSchema ({ book, entry }). */
@Serializable
data class BookDetailResponseDto(
    val book: BookDetailDto,
    val entry: BookEntryDto? = null,
)

/**
 * Espelha UpsertBookEntryRequestSchema — todos os campos opcionais (upsert
 * parcial: manda só o que mudou). `favorited` aqui é bool simples, não
 * `favoritedAt` (o backend decide o timestamp).
 */
@Serializable
data class UpsertBookEntryRequestDto(
    val status: BookStatus? = null,
    val rating: Double? = null,
    val review: String? = null,
    val favorited: Boolean? = null,
)

/**
 * Espelha AuthorBooksResponseSchema. Diferente de série/filme (sem "detalhe
 * do autor" — a Google Books não tem ID de autor, só o nome buscado e os
 * livros encontrados pra ele, sem paginação).
 */
@Serializable
data class AuthorBooksResponseDto(
    val name: String,
    val books: List<BookSummaryDto>,
)
