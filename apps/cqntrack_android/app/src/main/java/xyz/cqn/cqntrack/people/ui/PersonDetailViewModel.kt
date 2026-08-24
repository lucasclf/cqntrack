package xyz.cqn.cqntrack.people.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.people.data.PeopleRepository
import xyz.cqn.cqntrack.people.data.PersonCreditsResponseDto
import javax.inject.Inject

data class PersonDetailUiState(
    val isLoading: Boolean = true,
    val detail: PersonCreditsResponseDto? = null,
    val errorMessage: String? = null,
)

/** Sem cache: busca ao vivo na TMDB a cada acesso, mesmo espírito de PersonDetail.tsx no web. */
@HiltViewModel
class PersonDetailViewModel @Inject constructor(
    private val peopleRepository: PeopleRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // Nome precisa bater com NavRoutes.PERSON_DETAIL ("{personId}").
    private val personId: Int = checkNotNull(savedStateHandle.get<String>("personId")).toInt()

    private val _uiState = MutableStateFlow(PersonDetailUiState())
    val uiState: StateFlow<PersonDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val detail = peopleRepository.getPersonDetail(personId)
                _uiState.update { it.copy(isLoading = false, detail = detail) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Falha ao carregar.") }
            }
        }
    }
}
