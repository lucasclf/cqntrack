package xyz.cqn.cqntrack.activity.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.activity.data.ActivityItemDto
import xyz.cqn.cqntrack.activity.data.ActivityRepository
import xyz.cqn.cqntrack.activity.data.MediaType
import javax.inject.Inject

data class ActivityUiState(
    val isLoading: Boolean = true,
    val items: List<ActivityItemDto> = emptyList(),
    val nextCursor: String? = null,
    val loadingMore: Boolean = false,
    val mediaTypeFilter: MediaType? = null,
    val errorMessage: String? = null,
)

/** Feed de atividade do próprio usuário (GET /api/activity), paginado por cursor — mesmo padrão de ActivityFeed.tsx no web. */
@HiltViewModel
class ActivityViewModel @Inject constructor(
    private val activityRepository: ActivityRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ActivityUiState())
    val uiState: StateFlow<ActivityUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun setMediaTypeFilter(mediaType: MediaType?) {
        if (_uiState.value.mediaTypeFilter == mediaType) return
        _uiState.update { it.copy(mediaTypeFilter = mediaType) }
        load()
    }

    fun loadMore() {
        val cursor = _uiState.value.nextCursor ?: return
        if (_uiState.value.loadingMore) return
        load(before = cursor, appending = true)
    }

    private fun load(before: String? = null, appending: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !appending, loadingMore = appending, errorMessage = null) }
            try {
                val response = activityRepository.getActivity(before, _uiState.value.mediaTypeFilter)
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
                    it.copy(isLoading = false, loadingMore = false, errorMessage = "Falha ao carregar sua atividade recente.")
                }
            }
        }
    }
}
