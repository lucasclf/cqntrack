package xyz.cqn.cqntrack.profile.data

import kotlinx.serialization.Serializable
import xyz.cqn.cqntrack.books.data.BookSummaryDto
import xyz.cqn.cqntrack.games.data.GameSummaryDto
import xyz.cqn.cqntrack.manga.data.MangaSummaryDto
import xyz.cqn.cqntrack.movies.data.MovieSummaryDto
import xyz.cqn.cqntrack.series.data.SeriesSummaryDto

/**
 * Envelopes mínimos pra GET /api/users/:username/<seção>/favorites — o
 * shape real de cada item tem bem mais campos (status, rating, etc., ver
 * <Seção>EntryWithXxxSchema no backend), mas o `Json` global já usa
 * `ignoreUnknownKeys = true`, então só declarar o resumo aninhado
 * (`book`/`movie`/`game`/`series`/`manga`) já basta — sem duplicar as
 * entry DTOs completas só pra essa tela.
 */
@Serializable
data class BookFavoriteItemDto(val book: BookSummaryDto)

@Serializable
data class BookFavoritesEnvelope(val items: List<BookFavoriteItemDto>)

@Serializable
data class MovieFavoriteItemDto(val movie: MovieSummaryDto)

@Serializable
data class MovieFavoritesEnvelope(val items: List<MovieFavoriteItemDto>)

@Serializable
data class GameFavoriteItemDto(val game: GameSummaryDto)

@Serializable
data class GameFavoritesEnvelope(val items: List<GameFavoriteItemDto>)

@Serializable
data class SeriesFavoriteItemDto(val series: SeriesSummaryDto)

@Serializable
data class SeriesFavoritesEnvelope(val items: List<SeriesFavoriteItemDto>)

@Serializable
data class MangaFavoriteItemDto(val manga: MangaSummaryDto)

@Serializable
data class MangaFavoritesEnvelope(val items: List<MangaFavoriteItemDto>)

enum class FavoriteMediaType { BOOK, MOVIE, GAME, SERIES, MANGA }

/** Modelo unificado pra UI — normaliza os 5 shapes diferentes de resumo num só, pra uma lista/grade só. */
data class FavoriteItem(
    val id: String,
    val title: String,
    val imageUrl: String?,
    val mediaType: FavoriteMediaType,
)
