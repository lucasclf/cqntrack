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
import xyz.cqn.cqntrack.profile.data.FavoriteItem
import xyz.cqn.cqntrack.profile.data.ProfileRepository
import xyz.cqn.cqntrack.profile.data.PublicProfileDto
import javax.inject.Inject

data class PublicProfileUiState(
    val isLoading: Boolean = true,
    val profile: PublicProfileDto? = null,
    val errorMessage: String? = null,
    val favorites: List<FavoriteItem> = emptyList(),
    val favoritesLoading: Boolean = true,
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
    }
}
