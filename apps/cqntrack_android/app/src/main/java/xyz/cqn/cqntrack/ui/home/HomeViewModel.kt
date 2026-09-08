package xyz.cqn.cqntrack.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.BuildConfig
import xyz.cqn.cqntrack.update.data.UpdateRepository
import javax.inject.Inject

data class HomeUiState(
    val updateVersion: String? = null,
)

/** Só cuida do aviso de atualização — a grade de categorias em si não tem estado (HomeScreen). */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val updateRepository: UpdateRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val newerVersion = updateRepository.checkForNewerVersion(BuildConfig.VERSION_NAME)
            _uiState.update { it.copy(updateVersion = newerVersion) }
        }
    }

    fun dismissUpdate() {
        _uiState.update { it.copy(updateVersion = null) }
    }
}
