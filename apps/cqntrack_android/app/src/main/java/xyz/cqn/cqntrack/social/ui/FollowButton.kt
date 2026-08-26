package xyz.cqn.cqntrack.social.ui

import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import xyz.cqn.cqntrack.social.data.SocialRepository
import javax.inject.Inject

/**
 * Botão de seguir/deixar de seguir reutilizável — usado tanto no cabeçalho do perfil público
 * quanto em linha, um por resultado de SocialSearchScreen. Cada instância resolve seu próprio
 * status sozinha (GET /api/social/follow/{username}/status), mesmo espírito de FollowButton.tsx
 * no web — aceitável nessa escala (poucas dezenas de linhas por vez).
 *
 * `viewerUsername` é resolvido por quem chama (ProfileRepository.getMe(), mesmo padrão já usado
 * em PublicProfileViewModel) — não busca de novo aqui. `null`/igual a `username` esconde o botão.
 */
@Composable
fun FollowButton(
    username: String,
    viewerUsername: String?,
    viewModel: FollowButtonViewModel = hiltViewModel(key = username),
) {
    if (viewerUsername == null || viewerUsername == username) return

    LaunchedEffect(username) { viewModel.ensureLoaded(username) }
    val following by viewModel.following.collectAsState()
    val isFollowing = following ?: return

    if (isFollowing) {
        OutlinedButton(onClick = { viewModel.toggle(username) }) { Text("Seguindo") }
    } else {
        Button(
            onClick = { viewModel.toggle(username) },
            colors = ButtonDefaults.buttonColors(),
        ) { Text("Seguir") }
    }
}

@HiltViewModel
class FollowButtonViewModel @Inject constructor(
    private val socialRepository: SocialRepository,
) : ViewModel() {

    private val _following = MutableStateFlow<Boolean?>(null)
    val following: StateFlow<Boolean?> = _following.asStateFlow()

    private var loadedUsername: String? = null

    fun ensureLoaded(username: String) {
        if (loadedUsername == username) return
        loadedUsername = username
        viewModelScope.launch {
            _following.value = runCatching { socialRepository.getFollowStatus(username) }.getOrNull()
        }
    }

    fun toggle(username: String) {
        val current = _following.value ?: return
        _following.value = !current
        viewModelScope.launch {
            try {
                if (current) socialRepository.unfollow(username) else socialRepository.follow(username)
            } catch (e: Exception) {
                _following.value = current
            }
        }
    }
}
