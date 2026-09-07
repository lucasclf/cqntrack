package xyz.cqn.cqntrack.series.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.series.data.ContinueWatchingItemDto
import xyz.cqn.cqntrack.series.data.SeriesRepository
import javax.inject.Inject

data class ContinueWatchingUiState(
    val isLoading: Boolean = true,
    val items: List<ContinueWatchingItemDto> = emptyList(),
    val nextCursor: Int? = 0,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
    // tmdbId das séries com o swipe em andamento (ver markEpisodeWatched) — usado só pra
    // desabilitar o swipe de novo naquela linha enquanto a chamada não volta, não afeta
    // isLoading/errorMessage (é uma ação pontual numa linha, não um estado de tela).
    val updatingSeriesIds: Set<Int> = emptySet(),
)

/** Espelha ContinueWatching.tsx no web — calculado ao vivo pelo backend, paginado por cursor (índice). */
@HiltViewModel
class ContinueWatchingViewModel @Inject constructor(
    private val seriesRepository: SeriesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ContinueWatchingUiState())
    val uiState: StateFlow<ContinueWatchingUiState> = _uiState.asStateFlow()

    init {
        load(cursor = 0)
    }

    fun loadMore() {
        val cursor = _uiState.value.nextCursor ?: return
        if (_uiState.value.loadingMore) return
        load(cursor = cursor, appending = true)
    }

    private fun load(cursor: Int, appending: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !appending, loadingMore = appending, errorMessage = null) }
            try {
                val response = seriesRepository.getContinueWatching(cursor)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        loadingMore = false,
                        items = if (appending) it.items + response.items else response.items,
                        nextCursor = response.nextCursor,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, loadingMore = false, errorMessage = "Falha ao carregar as séries em andamento.")
                }
            }
        }
    }

    /**
     * Arrastar um item marca o episódio como assistido e atualiza só aquela linha (pro próximo
     * episódio pendente, ou remove se a série ficou em dia) — sem recarregar a lista inteira.
     * Não é otimista de propósito: só se sabe qual é o "próximo" depois da resposta do servidor
     * (é ele quem resolve gaps/temporada seguinte/status ended, ver continue-watching.service.ts),
     * então a linha fica sinalizada como "atualizando" (uiState.updatingSeriesIds) em vez de mudar
     * na hora.
     */
    fun markEpisodeWatched(item: ContinueWatchingItemDto) {
        val tmdbId = item.series.tmdbId
        if (tmdbId in _uiState.value.updatingSeriesIds) return

        _uiState.update { it.copy(updatingSeriesIds = it.updatingSeriesIds + tmdbId) }
        viewModelScope.launch {
            try {
                seriesRepository.setEpisodeWatched(
                    tmdbId,
                    item.nextEpisode.seasonNumber,
                    item.nextEpisode.episodeNumber,
                    true,
                )
                val updated = seriesRepository.getContinueWatchingForSeries(tmdbId).item
                _uiState.update { state ->
                    state.copy(
                        updatingSeriesIds = state.updatingSeriesIds - tmdbId,
                        items = if (updated != null) {
                            state.items.map { if (it.series.tmdbId == tmdbId) updated else it }
                        } else {
                            state.items.filterNot { it.series.tmdbId == tmdbId }
                        },
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        updatingSeriesIds = it.updatingSeriesIds - tmdbId,
                        errorMessage = "Falha ao marcar como assistido. Tente de novo.",
                    )
                }
            }
        }
    }
}
