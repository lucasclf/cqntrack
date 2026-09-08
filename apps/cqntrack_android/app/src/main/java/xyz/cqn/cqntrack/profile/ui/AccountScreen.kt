package xyz.cqn.cqntrack.profile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.BuildConfig

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
                val pickImageLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.PickVisualMedia(),
                ) { uri -> uri?.let(viewModel::uploadAvatar) }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(padding)
                        .padding(16.dp),
                ) {
                    Row {
                        AsyncImage(
                            model = uiState.avatarUrl,
                            contentDescription = null,
                            modifier = Modifier.size(72.dp).clip(CircleShape),
                        )
                        Column(modifier = Modifier.padding(start = 16.dp)) {
                            Text("@${user.displayUsername}", style = MaterialTheme.typography.bodyMedium)
                            Text(user.email, style = MaterialTheme.typography.bodyMedium)
                            TextButton(
                                onClick = {
                                    pickImageLauncher.launch(
                                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                    )
                                },
                                enabled = !uiState.avatarUploading,
                            ) {
                                Text(if (uiState.avatarUploading) "Enviando..." else "Trocar foto")
                            }
                        }
                    }
                    if (uiState.avatarError != null) {
                        Text(
                            uiState.avatarError.orEmpty(),
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

                    Text("Nome de exibição", style = MaterialTheme.typography.titleMedium)
                    var nameDraft by remember(user.name) { mutableStateOf(user.name) }
                    OutlinedTextField(
                        value = nameDraft,
                        onValueChange = { nameDraft = it },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    if (uiState.nameError != null) {
                        Text(
                            uiState.nameError.orEmpty(),
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    if (uiState.nameSaved) {
                        Text(
                            "Nome atualizado.",
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Button(
                        onClick = { viewModel.updateName(nameDraft) },
                        enabled = !uiState.nameSaving && nameDraft.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) {
                        Text(if (uiState.nameSaving) "Salvando..." else "Salvar nome")
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

                    Text("Alterar senha", style = MaterialTheme.typography.titleMedium)
                    var currentPassword by remember { mutableStateOf("") }
                    var newPassword by remember { mutableStateOf("") }
                    OutlinedTextField(
                        value = currentPassword,
                        onValueChange = { currentPassword = it },
                        label = { Text("Senha atual") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text("Nova senha") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    if (uiState.passwordError != null) {
                        Text(
                            uiState.passwordError.orEmpty(),
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    if (uiState.passwordSaved) {
                        Text(
                            "Senha alterada.",
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Button(
                        onClick = { viewModel.changePassword(currentPassword, newPassword) },
                        enabled = !uiState.passwordSaving &&
                            currentPassword.isNotBlank() &&
                            newPassword.length >= 8,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) {
                        Text(if (uiState.passwordSaving) "Salvando..." else "Alterar senha")
                    }
                    LaunchedEffect(uiState.passwordSaved) {
                        if (uiState.passwordSaved) {
                            currentPassword = ""
                            newPassword = ""
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

                    OutlinedButton(
                        onClick = { onViewPublicProfile(user.username) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Ver perfil público")
                    }

                    Button(
                        onClick = viewModel::signOut,
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    ) {
                        Text("Sair")
                    }

                    Text(
                        text = "Versão ${BuildConfig.VERSION_NAME}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    )
                }
            }
        }
    }
}
