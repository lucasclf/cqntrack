package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.CreateSeriesListRequestDto
import xyz.cqn.cqntrack.series.data.SeriesDetailDto
import xyz.cqn.cqntrack.series.data.SeriesEntryDto
import xyz.cqn.cqntrack.series.data.SeriesEpisodeDto
import xyz.cqn.cqntrack.series.data.SeriesListDto
import xyz.cqn.cqntrack.series.data.SeriesListsRepository
import xyz.cqn.cqntrack.series.data.SeriesRepository
import xyz.cqn.cqntrack.series.data.UpsertSeriesEntryRequestDto
import javax.inject.Inject

data class SeriesDetailUiState(
    val isLoading: Boolean = true,
    val series: SeriesDetailDto? = null,
    val entry: SeriesEntryDto? = null,
    val errorMessage: String? = null,
    val selectedSeason: Int? = null,
    val episodes: List<SeriesEpisodeDto> = emptyList(),
    val episodesLoading: Boolean = false,
    val seasonActionPending: Boolean = false,
    val showAddToListDialog: Boolean = false,
    val availableLists: List<SeriesListDto> = emptyList(),
    val addToListMessage: String? = null,
)

@HiltViewModel
class SeriesDetailViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
    private val seriesListsRepository: SeriesListsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val tmdbId: Int = checkNotNull(savedStateHandle.get<String>("tmdbId")).toInt()

    private val _uiState = MutableStateFlow(SeriesDetailUiState())
    val uiState: StateFlow<SeriesDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val response = seriesRepository.getDetail(tmdbId)
                _uiState.update {
                    it.copy(isLoading = false, series = response.series, entry = response.entry)
                }
                // Abre direto na temporada sugerida pelo backend (próxima com episódio
                // pendente), caindo pra 1ª temporada da lista se não houver sugestão —
                // mesmo espírito de nextSeasonToWatch em SeriesDetail.tsx (web).
                val defaultSeason = response.nextSeasonToWatch
                    ?: response.series.seasons?.firstOrNull()?.seasonNumber
                if (defaultSeason != null) {
                    selectSeason(defaultSeason)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }

    fun selectSeason(seasonNumber: Int) {
        _uiState.update { it.copy(selectedSeason = seasonNumber, episodesLoading = true) }
        viewModelScope.launch {
            try {
                val response = seriesRepository.getSeasonEpisodes(tmdbId, seasonNumber)
                _uiState.update { it.copy(episodes = response.episodes, episodesLoading = false) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(episodesLoading = false, errorMessage = "Falha ao carregar episódios.")
                }
            }
        }
    }

    fun toggleFavorite() {
        val isFavorited = _uiState.value.entry?.favoritedAt != null
        updateEntry(UpsertSeriesEntryRequestDto(favorited = !isFavorited))
    }

    fun toggleAbandoned() {
        val isAbandoned = _uiState.value.entry?.abandonedAt != null
        updateEntry(UpsertSeriesEntryRequestDto(abandoned = !isAbandoned))
    }

    /** Otimista: atualiza a UI antes da resposta, reverte se a chamada falhar. */
    fun toggleEpisode(episodeNumber: Int, watched: Boolean) {
        val season = _uiState.value.selectedSeason ?: return
        setEpisodeLocally(episodeNumber, watched)
        viewModelScope.launch {
            try {
                seriesRepository.setEpisodeWatched(tmdbId, season, episodeNumber, watched)
                // Primeira marcação da série: `entry` ainda é null no cliente (nunca existiu
                // até o backend criar via ensureSeriesEntry dentro de setEpisodeWatched) —
                // bumpWatchedCount não tem o que incrementar, busca a entry criada em vez de
                // tentar um delta local. Achado testando contra dado real: sem isso, o contador
                // "X/Y episódios assistidos" ficava travado em 0 até a tela ser reaberta.
                if (_uiState.value.entry == null) refreshEntry() else bumpWatchedCount(if (watched) 1 else -1)
            } catch (e: Exception) {
                setEpisodeLocally(episodeNumber, !watched)
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    /** Marca/desmarca a temporada inteira de uma vez — mesmo espírito de setVolumeRead (mangá). */
    fun toggleSeason() {
        val season = _uiState.value.selectedSeason ?: return
        val allWatched = _uiState.value.episodes.isNotEmpty() && _uiState.value.episodes.all { it.watched }
        val nextWatched = !allWatched

        _uiState.update { it.copy(seasonActionPending = true) }
        viewModelScope.launch {
            try {
                seriesRepository.setSeasonWatched(tmdbId, season, nextWatched)
                _uiState.update { state ->
                    state.copy(
                        seasonActionPending = false,
                        episodes = state.episodes.map { it.copy(watched = nextWatched) },
                    )
                }
                load()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(seasonActionPending = false, errorMessage = "Falha ao salvar. Tente de novo.")
                }
            }
        }
    }

    private fun setEpisodeLocally(episodeNumber: Int, watched: Boolean) {
        _uiState.update { state ->
            state.copy(
                episodes = state.episodes.map {
                    if (it.episodeNumber == episodeNumber) it.copy(watched = watched) else it
                },
            )
        }
    }

    private fun bumpWatchedCount(delta: Int) {
        _uiState.update { state ->
            val entry = state.entry ?: return@update state
            state.copy(entry = entry.copy(watchedEpisodeCount = entry.watchedEpisodeCount + delta))
        }
    }

    private suspend fun refreshEntry() {
        try {
            val response = seriesRepository.getDetail(tmdbId)
            _uiState.update { it.copy(entry = response.entry) }
        } catch (e: Exception) {
            // Progresso já foi salvo no servidor (a chamada que disparou isto teve sucesso) —
            // só o contador na tela que fica desatualizado até a próxima abertura da tela.
        }
    }

    fun setRating(rating: Double?) {
        viewModelScope.launch {
            try {
                val updated = seriesRepository.setRating(tmdbId, rating)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun setReview(review: String?) {
        viewModelScope.launch {
            try {
                val updated = seriesRepository.setReview(tmdbId, review)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun removeEntry() {
        viewModelScope.launch {
            try {
                seriesRepository.deleteEntry(tmdbId)
                _uiState.update { it.copy(entry = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao remover marcação. Tente de novo.") }
            }
        }
    }

    private fun updateEntry(body: UpsertSeriesEntryRequestDto) {
        viewModelScope.launch {
            try {
                val updated = seriesRepository.upsertEntry(tmdbId, body)
                _uiState.update { it.copy(entry = updated) }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Falha ao salvar. Tente de novo.") }
            }
        }
    }

    fun openAddToListDialog() {
        _uiState.update { it.copy(showAddToListDialog = true, addToListMessage = null) }
        viewModelScope.launch {
            try {
                val lists = seriesListsRepository.getLists()
                _uiState.update { it.copy(availableLists = lists) }
            } catch (e: Exception) {
                // Diálogo ainda funciona pra criar lista nova mesmo se isso falhar.
            }
        }
    }

    fun closeAddToListDialog() = _uiState.update { it.copy(showAddToListDialog = false) }

    fun addToList(listId: String) {
        viewModelScope.launch {
            try {
                seriesListsRepository.addItem(listId, tmdbId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao adicionar à lista.") }
            }
        }
    }

    fun createListAndAdd(name: String) {
        viewModelScope.launch {
            try {
                val list = seriesListsRepository.createList(CreateSeriesListRequestDto(name))
                seriesListsRepository.addItem(list.id, tmdbId)
                _uiState.update { it.copy(showAddToListDialog = false, addToListMessage = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(addToListMessage = "Falha ao criar lista.") }
            }
        }
    }
}
