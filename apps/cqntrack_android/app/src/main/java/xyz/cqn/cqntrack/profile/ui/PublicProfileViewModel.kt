package xyz.cqn.cqntrack.profile.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.books.data.BookStatus
import xyz.cqn.cqntrack.books.data.PaginatedBookEntriesResponseDto
import xyz.cqn.cqntrack.games.data.GameStatus
import xyz.cqn.cqntrack.games.data.PaginatedGameEntriesResponseDto
import xyz.cqn.cqntrack.manga.data.MangaStatus
import xyz.cqn.cqntrack.manga.data.PaginatedMangaEntriesResponseDto
import xyz.cqn.cqntrack.movies.data.MovieStatus
import xyz.cqn.cqntrack.movies.data.PaginatedMovieEntriesResponseDto
import xyz.cqn.cqntrack.profile.data.FavoriteItem
import xyz.cqn.cqntrack.profile.data.FavoriteMediaType
import xyz.cqn.cqntrack.profile.data.ProfileRepository
import xyz.cqn.cqntrack.profile.data.PublicProfileDto
import xyz.cqn.cqntrack.series.data.PaginatedSeriesEntriesResponseDto
import javax.inject.Inject

data class PublicProfileUiState(
    val isLoading: Boolean = true,
    val profile: PublicProfileDto? = null,
    val errorMessage: String? = null,
    val favorites: List<FavoriteItem> = emptyList(),
    val favoritesLoading: Boolean = true,
    val selectedTab: FavoriteMediaType = FavoriteMediaType.MOVIE,
    val entriesLoading: Boolean = false,
    val entriesErrorMessage: String? = null,
    val entriesPage: Int = 1,
    val bookStatusFilter: BookStatus? = null,
    val movieStatusFilter: MovieStatus? = null,
    val gameStatusFilter: GameStatus? = null,
    val mangaStatusFilter: MangaStatus? = null,
    val bookEntries: PaginatedBookEntriesResponseDto? = null,
    val movieEntries: PaginatedMovieEntriesResponseDto? = null,
    val gameEntries: PaginatedGameEntriesResponseDto? = null,
    val seriesEntries: PaginatedSeriesEntriesResponseDto? = null,
    val mangaEntries: PaginatedMangaEntriesResponseDto? = null,
)

@HiltViewModel
class PublicProfileViewModel @Inject constructor(
    private val profileRepository: ProfileRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val username: String = checkNotNull(savedStateHandle["username"])

    private val _uiState = MutableStateFlow(PublicProfileUiState())
    val uiState: StateFlow<PublicProfileUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val profile = profileRepository.getPublicProfile(username)
                _uiState.update { it.copy(isLoading = false, profile = profile) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Perfil não encontrado.") }
            }
        }

        // Chamada separada da identidade — favoritos de 5 seções demoram mais
        // (5 requests em paralelo) e não devem atrasar o cabeçalho aparecer.
        viewModelScope.launch {
            _uiState.update { it.copy(favoritesLoading = true) }
            val favorites = profileRepository.getFavorites(username)
            _uiState.update { it.copy(favoritesLoading = false, favorites = favorites) }
        }

        loadEntries()
    }

    fun selectTab(tab: FavoriteMediaType) {
        if (_uiState.value.selectedTab == tab) return
        _uiState.update { it.copy(selectedTab = tab, entriesPage = 1) }
        loadEntries()
    }

    fun setBookStatusFilter(status: BookStatus?) {
        _uiState.update { it.copy(bookStatusFilter = status, entriesPage = 1) }
        loadEntries()
    }

    fun setMovieStatusFilter(status: MovieStatus?) {
        _uiState.update { it.copy(movieStatusFilter = status, entriesPage = 1) }
        loadEntries()
    }

    fun setGameStatusFilter(status: GameStatus?) {
        _uiState.update { it.copy(gameStatusFilter = status, entriesPage = 1) }
        loadEntries()
    }

    fun setMangaStatusFilter(status: MangaStatus?) {
        _uiState.update { it.copy(mangaStatusFilter = status, entriesPage = 1) }
        loadEntries()
    }

    fun nextPage() {
        _uiState.update { it.copy(entriesPage = it.entriesPage + 1) }
        loadEntries()
    }

    fun prevPage() {
        if (_uiState.value.entriesPage <= 1) return
        _uiState.update { it.copy(entriesPage = it.entriesPage - 1) }
        loadEntries()
    }

    private fun loadEntries() {
        viewModelScope.launch {
            _uiState.update { it.copy(entriesLoading = true, entriesErrorMessage = null) }
            val s = _uiState.value
            try {
                when (s.selectedTab) {
                    FavoriteMediaType.BOOK -> {
                        val response = profileRepository.getBookEntries(username, s.bookStatusFilter, s.entriesPage)
                        _uiState.update { it.copy(entriesLoading = false, bookEntries = response) }
                    }
                    FavoriteMediaType.MOVIE -> {
                        val response = profileRepository.getMovieEntries(username, s.movieStatusFilter, s.entriesPage)
                        _uiState.update { it.copy(entriesLoading = false, movieEntries = response) }
                    }
                    FavoriteMediaType.GAME -> {
                        val response = profileRepository.getGameEntries(username, s.gameStatusFilter, s.entriesPage)
                        _uiState.update { it.copy(entriesLoading = false, gameEntries = response) }
                    }
                    FavoriteMediaType.SERIES -> {
                        val response = profileRepository.getSeriesEntries(username, s.entriesPage)
                        _uiState.update { it.copy(entriesLoading = false, seriesEntries = response) }
                    }
                    FavoriteMediaType.MANGA -> {
                        val response = profileRepository.getMangaEntries(username, s.mangaStatusFilter, s.entriesPage)
                        _uiState.update { it.copy(entriesLoading = false, mangaEntries = response) }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(entriesLoading = false, entriesErrorMessage = "Falha ao carregar marcações.") }
            }
        }
    }
}
