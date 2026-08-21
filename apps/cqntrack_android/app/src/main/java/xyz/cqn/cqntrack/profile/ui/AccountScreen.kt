package xyz.cqn.cqntrack.profile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountScreen(
    onViewPublicProfile: (username: String) -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Minha conta") }) },
    ) { padding ->
        when {
            uiState.isLoading -> Row(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator() }

            uiState.user == null -> Text(
                text = uiState.errorMessage ?: "Falha ao carregar.",
                modifier = Modifier.padding(padding).padding(16.dp),
            )

            else -> {
                val user = uiState.user!!
                Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                    Text(user.name, style = MaterialTheme.typography.titleLarge)
                    Text("@${user.displayUsername}", style = MaterialTheme.typography.bodyMedium)
                    Text(user.email, style = MaterialTheme.typography.bodyMedium)

                    OutlinedButton(
                        onClick = { onViewPublicProfile(user.username) },
                        modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                    ) {
                        Text("Ver perfil público")
                    }

                    Button(
                        onClick = viewModel::signOut,
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    ) {
                        Text("Sair")
                    }
                }
            }
        }
    }
}
